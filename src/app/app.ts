import { Component, OnDestroy, computed, signal } from '@angular/core';

type GroupMode = 'all' | 'day' | 'stage' | 'category';

interface Session {
  date: string;
  start: string;
  end: string;
  stage: string;
  speaker: string;
  role: string;
  title: string;
  category: string;
  language: string;
}

interface SessionGroup {
  name: string;
  sessions: Session[];
}

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnDestroy {
  private readonly favoriteStorageKey = 'talentarena-favorites';
  private readonly clockIntervalMs = 30_000;
  private readonly autoFocusRetryDelayMs = 80;
  private readonly maxAutoFocusAttempts = 12;
  private clockTimerId: ReturnType<typeof setInterval> | null = null;
  private hasAutoFocusedOnLoad = false;
  private autoFocusAttempts = 0;
  private readonly mockNow = this.readMockNowFromUrl();

  protected readonly sessions = signal<Session[]>([]);
  protected readonly groupMode = signal<GroupMode>('all');
  protected readonly searchText = signal('');
  protected readonly selectedDays = signal<Set<string>>(new Set<string>());
  protected readonly selectedStages = signal<Set<string>>(new Set<string>());
  protected readonly selectedCategories = signal<Set<string>>(new Set<string>());
  protected readonly isControlsExpanded = signal(true);
  protected readonly isCombinedFiltersExpanded = signal(false);
  protected readonly showOnlyFavorites = signal(false);
  protected readonly showFinishedSessions = signal(true);
  protected readonly favoriteIds = signal<Set<string>>(this.readFavoriteIds());

  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly now = signal(new Date());

  protected readonly groupedSessions = computed(() => {
    const sessions = this.filteredSessions();
    const mode = this.groupMode();

    if (mode === 'all') {
      return [{ name: 'All Sessions', sessions }];
    }

    const groupMap = new Map<string, Session[]>();
    for (const session of sessions) {
      const key = this.getGroupKey(session, mode);
      const groupSessions = groupMap.get(key);
      if (groupSessions) {
        groupSessions.push(session);
      } else {
        groupMap.set(key, [session]);
      }
    }

    return Array.from(groupMap.entries())
      .map(([name, grouped]) => ({
        name,
        sessions: this.sortSessions(grouped),
      }))
      .sort((a, b) => this.compareGroupNames(a.name, b.name, mode));
  });

  protected readonly sessionCount = computed(() => this.filteredSessions().length);

  protected readonly totalCount = computed(() => this.sessions().length);

  protected readonly favoriteCount = computed(() => this.favoriteIds().size);

  protected readonly availableDays = computed(() =>
    Array.from(new Set(this.sessions().map((session) => session.date))).sort(
      (a, b) => this.parseDate(a) - this.parseDate(b)
    )
  );

  protected readonly availableStages = computed(() =>
    Array.from(new Set(this.sessions().map((session) => session.stage))).sort((a, b) => a.localeCompare(b))
  );

  protected readonly availableCategories = computed(() =>
    Array.from(new Set(this.sessions().map((session) => session.category))).sort((a, b) => a.localeCompare(b))
  );

  protected readonly currentDateTimeLabel = computed(() =>
    this.now().toLocaleString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  );

  protected readonly currentSessionIds = computed(() => {
    const now = this.now();
    const currentDateLabel = this.getCurrentDateLabel(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return new Set(
      this.sessions()
        .filter((session) => {
          if (session.date !== currentDateLabel) {
            return false;
          }

          const startMinutes = this.parseTime(session.start);
          const endMinutes = this.parseTime(session.end);
          return currentMinutes >= startMinutes && currentMinutes < endMinutes;
        })
        .map((session) => this.getSessionId(session))
    );
  });

  private readonly timeSlotHueMap = computed(() => {
    const slotKeys = Array.from(new Set(this.sessions().map((session) => this.getTimeSlotKey(session))))
      .sort((a, b) => {
        return this.parseTime(a) - this.parseTime(b);
      });

    const hueBySlot = new Map<string, number>();
    const contrastHueSequence = [195, 325, 38, 265, 155, 8, 220, 300, 82, 248, 128, 352];
    slotKeys.forEach((slotKey, index) => {
      const hue = contrastHueSequence[index % contrastHueSequence.length];
      hueBySlot.set(slotKey, hue);
    });

    return hueBySlot;
  });

  private readonly filteredSessions = computed(() => {
    const sessions = this.sessions().filter((session) => this.matchesCombinedFilters(session));
    const filteredByFinished = this.showFinishedSessions()
      ? sessions
      : sessions.filter((session) => !this.isFinishedSession(session));
    const favorites = this.favoriteIds();

    if (!this.showOnlyFavorites()) {
      return this.sortSessions(filteredByFinished);
    }

    return this.sortSessions(filteredByFinished.filter((session) => favorites.has(this.getSessionId(session))));
  });

  constructor() {
    this.startClock();
    this.loadSessions();
  }

  ngOnDestroy(): void {
    if (this.clockTimerId !== null) {
      globalThis.clearInterval(this.clockTimerId);
      this.clockTimerId = null;
    }
  }

  protected isFavorite(session: Session): boolean {
    return this.favoriteIds().has(this.getSessionId(session));
  }

  protected toggleFavorite(session: Session): void {
    const id = this.getSessionId(session);
    const updated = new Set(this.favoriteIds());

    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }

    this.favoriteIds.set(updated);
    this.persistFavoriteIds(updated);
  }

  protected clearFavorites(): void {
    const cleared = new Set<string>();
    this.favoriteIds.set(cleared);
    this.persistFavoriteIds(cleared);
  }

  protected setGroupMode(mode: GroupMode): void {
    this.groupMode.set(mode);
  }

  protected toggleFavoritesOnly(): void {
    this.showOnlyFavorites.update((value) => !value);
  }

  protected toggleFinishedSessions(): void {
    this.showFinishedSessions.update((value) => !value);
  }

  protected updateSearchText(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.searchText.set(input?.value ?? '');
  }

  protected clearSearchText(): void {
    this.searchText.set('');
  }

  protected isDaySelected(day: string): boolean {
    return this.selectedDays().has(day);
  }

  protected isStageSelected(stage: string): boolean {
    return this.selectedStages().has(stage);
  }

  protected isCategorySelected(category: string): boolean {
    return this.selectedCategories().has(category);
  }

  protected toggleDay(day: string): void {
    this.toggleSetValue(this.selectedDays, day);
  }

  protected toggleStage(stage: string): void {
    this.toggleSetValue(this.selectedStages, stage);
  }

  protected toggleCategory(category: string): void {
    this.toggleSetValue(this.selectedCategories, category);
  }

  protected areAllDaysSelected(): boolean {
    const available = this.availableDays();
    const selected = this.selectedDays();
    return available.length > 0 && selected.size === available.length;
  }

  protected areAllStagesSelected(): boolean {
    const available = this.availableStages();
    const selected = this.selectedStages();
    return available.length > 0 && selected.size === available.length;
  }

  protected areAllCategoriesSelected(): boolean {
    const available = this.availableCategories();
    const selected = this.selectedCategories();
    return available.length > 0 && selected.size === available.length;
  }

  protected selectAllDays(): void {
    this.selectedDays.set(new Set(this.availableDays()));
  }

  protected clearDays(): void {
    this.selectedDays.set(new Set<string>());
  }

  protected selectAllStages(): void {
    this.selectedStages.set(new Set(this.availableStages()));
  }

  protected clearStages(): void {
    this.selectedStages.set(new Set<string>());
  }

  protected selectAllCategories(): void {
    this.selectedCategories.set(new Set(this.availableCategories()));
  }

  protected clearCategories(): void {
    this.selectedCategories.set(new Set<string>());
  }

  protected clearCombinedFilters(): void {
    this.selectedDays.set(new Set<string>());
    this.selectedStages.set(new Set<string>());
    this.selectedCategories.set(new Set<string>());
  }

  protected toggleCombinedFiltersExpanded(): void {
    this.isCombinedFiltersExpanded.update((value) => !value);
  }

  protected toggleControlsExpanded(): void {
    this.isControlsExpanded.update((value) => !value);
  }

  private async loadSessions(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(null);

    try {
      const response = await fetch('talentarena.json');
      if (!response.ok) {
        throw new Error(`Unable to load agenda (${response.status})`);
      }

      const data = (await response.json()) as Session[];
      this.sessions.set(this.sortSessions(data));
      this.scheduleAutoFocusCurrentSession();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load agenda';
      this.loadError.set(message);
    } finally {
      this.isLoading.set(false);
    }
  }

  private getGroupKey(session: Session, mode: GroupMode): string {
    if (mode === 'day') {
      return session.date;
    }

    if (mode === 'stage') {
      return session.stage;
    }

    return session.category;
  }

  protected getSessionId(session: Session): string {
    return [session.date, session.start, session.end, session.stage, session.title, session.speaker].join('|');
  }

  protected getCardHue(session: Session): number {
    const slotKey = this.getTimeSlotKey(session);
    return this.timeSlotHueMap().get(slotKey) ?? 220;
  }

  protected isXproSession(session: Session): boolean {
    return session.stage.toLowerCase().includes('xpro');
  }

  protected isCurrentSession(session: Session): boolean {
    return this.currentSessionIds().has(this.getSessionId(session));
  }

  protected isFinishedSession(session: Session): boolean {
    const now = this.now();
    const currentDateLabel = this.getCurrentDateLabel(now);
    const currentDateValue = this.parseDate(currentDateLabel);
    const sessionDateValue = this.parseDate(session.date);

    if (sessionDateValue < currentDateValue) {
      return true;
    }

    if (sessionDateValue > currentDateValue) {
      return false;
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return currentMinutes >= this.parseTime(session.end);
  }

  protected getSessionDomId(session: Session): string {
    return `session-${this.getSessionId(session).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  }

  private matchesCombinedFilters(session: Session): boolean {
    return (
      this.matchesFilterSet(this.selectedDays(), session.date) &&
      this.matchesFilterSet(this.selectedStages(), session.stage) &&
      this.matchesFilterSet(this.selectedCategories(), session.category) &&
      this.matchesSearchText(session)
    );
  }

  private matchesSearchText(session: Session): boolean {
    const term = this.searchText().trim().toLowerCase();
    if (!term) {
      return true;
    }

    const searchableText = Object.values(session).join(' ').toLowerCase();
    return searchableText.includes(term);
  }

  private getTimeSlotKey(session: Session): string {
    return session.start;
  }

  private startClock(): void {
    if (this.mockNow) {
      this.now.set(this.mockNow);
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    this.now.set(new Date());
    this.clockTimerId = globalThis.setInterval(() => {
      this.now.set(new Date());
    }, this.clockIntervalMs);
  }

  private scheduleAutoFocusCurrentSession(): void {
    if (typeof window === 'undefined' || this.hasAutoFocusedOnLoad) {
      return;
    }

    this.autoFocusAttempts = 0;

    const attemptFocus = () => {
      if (this.hasAutoFocusedOnLoad) {
        return;
      }

      const didFocus = this.autoFocusCurrentSession();
      if (didFocus) {
        return;
      }

      this.autoFocusAttempts += 1;
      if (this.autoFocusAttempts >= this.maxAutoFocusAttempts) {
        return;
      }

      globalThis.setTimeout(attemptFocus, this.autoFocusRetryDelayMs);
    };

    globalThis.setTimeout(attemptFocus, 0);
  }

  private autoFocusCurrentSession(): boolean {
    if (typeof document === 'undefined') {
      return false;
    }

    if (this.hasAutoFocusedOnLoad) {
      return true;
    }

    const firstCurrentSession = this.filteredSessions().find((session) => this.isCurrentSession(session));
    if (!firstCurrentSession) {
      return false;
    }

    const element = document.getElementById(this.getSessionDomId(firstCurrentSession));
    if (!element) {
      return false;
    }

    this.hasAutoFocusedOnLoad = true;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.focus({ preventScroll: true });
    return true;
  }

  private getCurrentDateLabel(date: Date): string {
    return date.toLocaleString('en-US', { month: 'long', day: 'numeric' });
  }

  private readMockNowFromUrl(): Date | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const value = new URLSearchParams(window.location.search).get('mockNow');
    if (!value) {
      return null;
    }

    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  private matchesFilterSet(filterSet: Set<string>, value: string): boolean {
    return filterSet.size === 0 || filterSet.has(value);
  }

  private toggleSetValue(target: { (): Set<string>; set: (value: Set<string>) => void }, value: string): void {
    const updated = new Set(target());
    if (updated.has(value)) {
      updated.delete(value);
    } else {
      updated.add(value);
    }

    target.set(updated);
  }

  private compareGroupNames(a: string, b: string, mode: GroupMode): number {
    if (mode === 'day') {
      return this.parseDate(a) - this.parseDate(b);
    }

    return a.localeCompare(b);
  }

  private sortSessions(sessions: Session[]): Session[] {
    return [...sessions].sort((a, b) => {
      const dateCompare = this.parseDate(a.date) - this.parseDate(b.date);
      if (dateCompare !== 0) {
        return dateCompare;
      }

      const startCompare = this.parseTime(a.start) - this.parseTime(b.start);
      if (startCompare !== 0) {
        return startCompare;
      }

      return a.stage.localeCompare(b.stage);
    });
  }

  private parseDate(value: string): number {
    const parsed = Date.parse(`${value}, 2026`);
    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
  }

  private parseTime(value: string): number {
    const [hours, minutes] = value.split(':').map((part) => Number(part));
    return (hours || 0) * 60 + (minutes || 0);
  }

  private readFavoriteIds(): Set<string> {
    if (typeof localStorage === 'undefined') {
      return new Set<string>();
    }

    const rawValue = localStorage.getItem(this.favoriteStorageKey);
    if (!rawValue) {
      return new Set<string>();
    }

    try {
      const parsed = JSON.parse(rawValue) as string[];
      return new Set(parsed);
    } catch {
      return new Set<string>();
    }
  }

  private persistFavoriteIds(ids: Set<string>): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.favoriteStorageKey, JSON.stringify(Array.from(ids)));
  }
}

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideZonelessChangeDetection } from '@angular/core';

describe('App', () => {
  let component: App;
  let fixture: ComponentFixture<App>;

  beforeEach(async () => {
    // We need to mock fetch to prevent the real App constructor from fetching data.
    globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo({
      ok: true,
      json: () => Promise.resolve([
        { ID: 1, date: 'October 12', start: '10:00', end: '11:00', stage: 'Stage A', speaker: 'Alice', role: 'Dev', title: 'Angular', category: 'Frontend', language: 'EN' }
      ])
    });

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideZonelessChangeDetection()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it('should clear search text', () => {
    (component as any).searchText.set('test');
    expect((component as any).searchText()).toBe('test');

    (component as any).clearSearchText();
    expect((component as any).searchText()).toBe('');
  });

  it('should toggle day', () => {
    expect((component as any).selectedDays().size).toBe(0);

    (component as any).toggleDay('October 12');
    expect((component as any).selectedDays().has('October 12')).toBeTrue();

    (component as any).toggleDay('October 12');
    expect((component as any).selectedDays().size).toBe(0);
  });

  it('should load sessions on init', async () => {
    // We need to wait for the fetch to resolve and signal to update
    await fixture.whenStable();
    expect((component as any).sessions().length).toBe(1);
    expect((component as any).sessions()[0].title).toBe('Angular');
  });
});

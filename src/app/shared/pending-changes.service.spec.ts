import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PendingChangesService, pendingChangesGuard } from './pending-changes.service';

@Component({ template: '' })
class TestPageComponent {}

describe('PendingChangesService', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([
    { path: 'years/:yearId', children: [{ path: 'attendance', component: TestPageComponent, canDeactivate: [pendingChangesGuard], runGuardsAndResolvers: 'always' }] },
    { path: 'other', component: TestPageComponent }
  ])] }));

  it('empêche le changement d’année et de page après refus', async () => {
    const harness = await RouterTestingHarness.create('/years/year-1/attendance');
    const pending = TestBed.inject(PendingChangesService);
    pending.dirty.set(true);
    spyOn(window, 'confirm').and.returnValue(false);
    await harness.navigateByUrl('/years/year-2/attendance');
    expect(TestBed.inject(Router).url).toBe('/years/year-1/attendance');
    await harness.navigateByUrl('/other');
    expect(TestBed.inject(Router).url).toBe('/years/year-1/attendance');
    expect(pending.dirty()).toBeTrue();
  });

  it('autorise le départ explicitement confirmé', async () => {
    const harness = await RouterTestingHarness.create('/years/year-1/attendance');
    const pending = TestBed.inject(PendingChangesService);
    pending.dirty.set(true);
    spyOn(window, 'confirm').and.returnValue(true);
    await harness.navigateByUrl('/other');
    expect(TestBed.inject(Router).url).toBe('/other');
    expect(pending.dirty()).toBeFalse();
  });

  it('bloque le départ pendant un enregistrement', () => {
    const pending = TestBed.inject(PendingChangesService);
    pending.saving.set(true);
    expect(pending.confirmLeave()).toBeFalse();
  });
});
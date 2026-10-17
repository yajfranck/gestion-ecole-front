import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ClassroomService } from './classroom.service';
import { environment } from '../../../environments/environment';

describe('ClassroomService', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('gère les salles dans le périmètre exact de la classe et permet un renommage partiel', () => {
    const api = TestBed.inject(ClassroomService);
    const http = TestBed.inject(HttpTestingController);
    const url = `${environment.apiUrl}/establishments/school/school-years/year/classes/class/classrooms`;
    api.list('school', 'year', 'class').subscribe();
    http.expectOne(url).flush([]);
    api.create('school', 'year', 'class', { code: 'B', name: 'Sixième B', maxStudents: 32 }).subscribe();
    const create = http.expectOne(url);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ code: 'B', name: 'Sixième B', maxStudents: 32 });
    create.flush({});
    api.update('school', 'year', 'class', 'room', { name: 'Sixième B - groupe 2', maxStudents: 30 }).subscribe();
    const update = http.expectOne(`${url}/room`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ name: 'Sixième B - groupe 2', maxStudents: 30 });
    update.flush({});
    api.archive('school', 'year', 'class', 'room').subscribe();
    const archive = http.expectOne(`${url}/room`);
    expect(archive.request.method).toBe('DELETE');
    archive.flush(null);
  });
});

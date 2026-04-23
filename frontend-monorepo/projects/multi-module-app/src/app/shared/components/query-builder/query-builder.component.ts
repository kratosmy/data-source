import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FilterField } from '../../../core/config/data-query.config';

export interface QueryCondition {
  field: string;
  operator: string;
  value: string | boolean;
}

interface FieldGroupViewModel {
  key: string;
  label: string | null;
  fields: FilterField[];
}

@Component({
  selector: 'app-query-builder',
  templateUrl: './query-builder.component.html',
  styleUrls: ['./query-builder.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTimepickerModule,
    MatTooltipModule,
    MatCheckboxModule
  ]
})
export class QueryBuilderComponent implements OnInit, OnChanges {
  @Input() availableFields: FilterField[] = [];
  @Input() apiEndpoint: string | null = null;
  @Output() querySubmit = new EventEmitter<QueryCondition[]>();

  queryForm!: FormGroup;
  isAdvancedOpen = false;
  fieldGroups: FieldGroupViewModel[] = [];
  dropdownOptionsByField: Record<string, string[]> = {};
  filteredDropdownOptionsByField: Record<string, string[]> = {};

  constructor(
    private fb: FormBuilder,
    private http?: HttpClient
  ) {}

  ngOnInit() {
    if (!this.queryForm) {
      this.initForm();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['availableFields']) {
      this.initForm();
      this.loadDropdownOptions();
    }

    if (changes['apiEndpoint']) {
      this.loadDropdownOptions();
    }
  }

  initForm() {
    const formControls: {
      simpleSearch: FormControl<string | null>;
      advanced?: FormGroup;
    } = {
      simpleSearch: new FormControl('')
    };

    const advancedControls: Record<string, FormControl<string | string[] | Date | boolean | null>> = {};
    if (this.availableFields) {
      this.availableFields.forEach(field => {
        if (this.isRangeField(field)) {
          advancedControls[`${field.name}_start`] = new FormControl(null);
          advancedControls[`${field.name}_end`] = new FormControl(null);
        } else if (field.type === 'checkbox') {
          if ((field.checkboxOptions?.length ?? 0) > 0) {
            advancedControls[field.name] = new FormControl<string[]>([]);
          } else {
            advancedControls[field.name] = new FormControl(false);
          }
        } else {
          advancedControls[field.name] = new FormControl('');
        }
      });
    }

    this.fieldGroups = this.buildFieldGroups();
    formControls.advanced = this.fb.group(advancedControls);
    this.queryForm = this.fb.group(formControls);
    this.bindDropdownControlFilters();
  }

  get advancedForm(): FormGroup {
    return this.queryForm.get('advanced') as FormGroup;
  }

  toggleAdvanced() {
    this.isAdvancedOpen = !this.isAdvancedOpen;
  }

  resetForm() {
    this.queryForm.reset();
    this.isAdvancedOpen = false;
    this.querySubmit.emit([]);
  }

  formatDate(date: Date): string {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
  }

  formatTime(value: Date | string): string {
    if (value instanceof Date) {
      return [value.getHours(), value.getMinutes(), value.getSeconds()].map(part => this.padNumber(part)).join(':');
    }

    const parsed = this.parseTimeParts(value);
    if (!parsed) {
      return value.trim();
    }

    return parsed.map(part => this.padNumber(part)).join(':');
  }

  onSimpleSubmit() {
    const val = this.queryForm.get('simpleSearch')?.value?.trim();
    if (val) {
      this.querySubmit.emit([{ field: '_keyword_', operator: 'LIKE', value: val }]);
    } else {
      this.querySubmit.emit([]);
    }
  }

  onAdvancedSubmit() {
    const conditions: QueryCondition[] = [];
    const advancedValues = this.advancedForm.getRawValue() as Record<string, string | string[] | Date | boolean | null>;

    this.availableFields.forEach(field => {
      if (field.type === 'date') {
        const start = advancedValues[`${field.name}_start`];
        const end = advancedValues[`${field.name}_end`];
        if (start) {
          conditions.push({ field: field.name, operator: '>=', value: this.formatDate(start as Date) });
        }
        if (end) {
          conditions.push({ field: field.name, operator: '<=', value: this.formatDate(end as Date) });
        }
      } else if (field.type === 'time') {
        const start = advancedValues[`${field.name}_start`];
        const end = advancedValues[`${field.name}_end`];
        if (start) {
          conditions.push({ field: field.name, operator: '>=', value: this.formatTime(start as Date | string) });
        }
        if (end) {
          conditions.push({ field: field.name, operator: '<=', value: this.formatTime(end as Date | string) });
        }
      } else {
        const val = advancedValues[field.name];
        if (field.type === 'checkbox') {
          if ((field.checkboxOptions?.length ?? 0) > 0) {
            const selectedValues = Array.isArray(val) ? val.map(item => item.trim()).filter(item => item !== '') : [];
            if (selectedValues.length === 1) {
              conditions.push({ field: field.name, operator: '=', value: selectedValues[0] });
            } else if (selectedValues.length > 1) {
              conditions.push({ field: field.name, operator: 'IN', value: selectedValues.join(',') });
            }
          } else if (val === true) {
            conditions.push({ field: field.name, operator: '=', value: true });
          }
        } else if (typeof val === 'string' && val.trim() !== '') {
          conditions.push({ field: field.name, operator: 'LIKE', value: val.trim() });
        }
      }
    });

    this.querySubmit.emit(conditions);
  }

  onSearchClick() {
    this.onSimpleSubmit();
  }

  clearAdvancedFilters() {
    this.advancedForm.reset();
    Object.keys(this.dropdownOptionsByField).forEach(fieldName => this.filterDropdownOptions(fieldName));
  }

  applyAdvancedFilters() {
    this.onAdvancedSubmit();
    this.isAdvancedOpen = false;
  }

  isRangeField(field: FilterField): boolean {
    return field.type === 'date' || field.type === 'time';
  }

  getFieldGridSpan(field: FilterField): number {
    if (field.gridSpan != null) {
      return field.gridSpan;
    }

    return this.isRangeField(field) ? 6 : 3;
  }

  getFieldPlaceholder(field: FilterField): string {
    return field.placeholder ?? '';
  }

  isDropdownField(field: FilterField): boolean {
    return field.type === 'string' && field.dropdown === true;
  }

  getFilteredDropdownOptions(fieldName: string): string[] {
    return this.filteredDropdownOptionsByField[fieldName] ?? [];
  }

  getRangeStartPlaceholder(field: FilterField): string {
    return field.type === 'time' ? 'Start time' : 'Start date';
  }

  getRangeEndPlaceholder(field: FilterField): string {
    return field.type === 'time' ? 'End time' : 'End date';
  }

  get activeAdvancedFilterCount(): number {
    if (!this.queryForm) {
      return 0;
    }

    const advancedValues = this.advancedForm.getRawValue() as Record<string, string | string[] | Date | boolean | null>;

    return this.availableFields.reduce((count, field) => {
      if (this.isRangeField(field)) {
        const hasRangeValue = Boolean(advancedValues[`${field.name}_start`] || advancedValues[`${field.name}_end`]);
        return hasRangeValue ? count + 1 : count;
      }

      const value = advancedValues[field.name];
      if (field.type === 'checkbox') {
        if ((field.checkboxOptions?.length ?? 0) > 0) {
          return Array.isArray(value) && value.length > 0 ? count + 1 : count;
        }
        return value === true ? count + 1 : count;
      }

      return typeof value === 'string' && value.trim() !== '' ? count + 1 : count;
    }, 0);
  }

  private buildFieldGroups(): FieldGroupViewModel[] {
    if (this.availableFields.length === 0) {
      return [];
    }

    const hasNamedGroups = this.availableFields.some(field => !!field.group?.trim());
    if (!hasNamedGroups) {
      return [
        {
          key: 'all-filters',
          label: null,
          fields: [...this.availableFields]
        }
      ];
    }

    const groupedFields = new Map<string, FilterField[]>();
    this.availableFields.forEach(field => {
      const groupLabel = field.group?.trim() || 'Other Filters';
      const fields = groupedFields.get(groupLabel) ?? [];
      fields.push(field);
      groupedFields.set(groupLabel, fields);
    });

    return Array.from(groupedFields.entries()).map(([label, fields]) => ({
      key: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      label,
      fields
    }));
  }

  onCheckboxOptionToggle(field: FilterField, optionValue: string, checked: boolean): void {
    const control = this.advancedForm.get(field.name);
    if (!control) {
      return;
    }

    const currentValues = Array.isArray(control.value) ? control.value : [];
    if (checked) {
      if (!currentValues.includes(optionValue)) {
        control.setValue([...currentValues, optionValue]);
      }
      return;
    }

    control.setValue(currentValues.filter(value => value !== optionValue));
  }

  isCheckboxOptionSelected(field: FilterField, optionValue: string): boolean {
    const controlValue = this.advancedForm.get(field.name)?.value;
    return Array.isArray(controlValue) && controlValue.includes(optionValue);
  }

  private loadDropdownOptions(): void {
    if (!this.http || !this.apiEndpoint) {
      return;
    }

    const dropdownFields = this.availableFields.filter(field => this.isDropdownField(field));
    if (dropdownFields.length === 0) {
      this.dropdownOptionsByField = {};
      this.filteredDropdownOptionsByField = {};
      return;
    }

    this.http.post<Record<string, unknown>[]>(`${this.apiEndpoint}/query`, { conditions: [] }).subscribe({
      next: rows => {
        const optionsByField: Record<string, string[]> = {};
        dropdownFields.forEach(field => {
          const uniqueValues = new Set<string>();
          (rows ?? []).forEach(row => {
            const rawValue = row?.[field.name];
            if (rawValue == null) {
              return;
            }
            const normalized = String(rawValue).trim();
            if (normalized !== '') {
              uniqueValues.add(normalized);
            }
          });
          optionsByField[field.name] = Array.from(uniqueValues).sort((a, b) => a.localeCompare(b));
        });

        this.dropdownOptionsByField = optionsByField;
        dropdownFields.forEach(field => this.filterDropdownOptions(field.name));
      },
      error: () => {
        this.dropdownOptionsByField = {};
        this.filteredDropdownOptionsByField = {};
      }
    });
  }

  private bindDropdownControlFilters(): void {
    const dropdownFields = this.availableFields.filter(field => this.isDropdownField(field));
    dropdownFields.forEach(field => {
      const control = this.advancedForm.get(field.name);
      if (!control) {
        return;
      }

      control.valueChanges.subscribe(() => this.filterDropdownOptions(field.name));
      this.filterDropdownOptions(field.name);
    });
  }

  private filterDropdownOptions(fieldName: string): void {
    const controlValue = this.advancedForm.get(fieldName)?.value;
    const keyword = typeof controlValue === 'string' ? controlValue.trim().toLowerCase() : '';
    const allOptions = this.dropdownOptionsByField[fieldName] ?? [];
    const matched = keyword === '' ? allOptions : allOptions.filter(item => item.toLowerCase().includes(keyword));
    if (keyword !== '' && !matched.some(item => item.toLowerCase() === keyword)) {
      this.filteredDropdownOptionsByField[fieldName] = [String(controlValue).trim(), ...matched];
      return;
    }
    this.filteredDropdownOptionsByField[fieldName] = matched;
  }

  private parseTimeParts(value: string): [number, number, number] | null {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    const parts = normalized.split(':');
    if (parts.length < 2 || parts.length > 3) {
      return null;
    }

    const numericParts = parts.map(part => Number(part));
    const hours = numericParts[0];
    const minutes = numericParts[1];
    const seconds = numericParts[2] ?? 0;
    if (hours == null || minutes == null) {
      return null;
    }

    if ([hours, minutes, seconds].some(part => Number.isNaN(part))) {
      return null;
    }

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
      return null;
    }

    return [hours, minutes, seconds];
  }

  private padNumber(value: number): string {
    return value.toString().padStart(2, '0');
  }
}

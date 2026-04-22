import { FormBuilder } from '@angular/forms';

import { BuiltinModules } from '../../../core/config/data-query.config';
import { QueryBuilderComponent } from './query-builder.component';

describe('QueryBuilderComponent', () => {
  let component: QueryBuilderComponent;

  beforeEach(() => {
    component = new QueryBuilderComponent(new FormBuilder());
    component.availableFields = BuiltinModules['xms'].filterFields;
    component.initForm();
  });

  it('keeps quick search separate from advanced filters', () => {
    spyOn(component.querySubmit, 'emit');
    component.queryForm.get('simpleSearch')?.setValue('USD');
    component.advancedForm.patchValue({ tradeType: 'Spot' });

    component.onSearchClick();

    expect(component.querySubmit.emit).toHaveBeenCalledWith([{ field: '_keyword_', operator: 'LIKE', value: 'USD' }]);
  });

  it('counts active advanced filters by field', () => {
    component.advancedForm.patchValue({
      tradeType: 'Spot',
      tradeDate_start: new Date('2024-03-01'),
      tradeDate_end: new Date('2024-03-31')
    });

    expect(component.activeAdvancedFilterCount).toBe(2);
  });

  it('clears only advanced values from the floating panel', () => {
    component.queryForm.get('simpleSearch')?.setValue('counterparty');
    component.advancedForm.patchValue({ tradeType: 'Spot' });

    component.clearAdvancedFilters();

    expect(component.queryForm.get('simpleSearch')?.value).toBe('counterparty');
    expect(component.activeAdvancedFilterCount).toBe(0);
  });

  it('toggles the floating panel explicitly', () => {
    expect(component.isAdvancedOpen).toBeFalse();

    component.toggleAdvanced();
    expect(component.isAdvancedOpen).toBeTrue();

    component.toggleAdvanced();
    expect(component.isAdvancedOpen).toBeFalse();
  });

  it('applies advanced filters and closes the floating panel', () => {
    spyOn(component.querySubmit, 'emit');
    component.isAdvancedOpen = true;
    component.advancedForm.patchValue({
      tradeType: 'Spot',
      tradeDate_start: new Date('2024-03-01')
    });

    component.applyAdvancedFilters();

    expect(component.querySubmit.emit).toHaveBeenCalledWith([
      { field: 'tradeType', operator: 'LIKE', value: 'Spot' },
      { field: 'tradeDate', operator: '>=', value: '2024-03-01' }
    ]);
    expect(component.isAdvancedOpen).toBeFalse();
  });

  it('treats checked checkbox fields as equals filters', () => {
    component.availableFields = [{ name: 'isActive', label: 'Active Only', type: 'checkbox' }];
    component.initForm();
    spyOn(component.querySubmit, 'emit');
    component.advancedForm.patchValue({ isActive: true });

    component.applyAdvancedFilters();

    expect(component.querySubmit.emit).toHaveBeenCalledWith([{ field: 'isActive', operator: '=', value: true }]);
  });
});

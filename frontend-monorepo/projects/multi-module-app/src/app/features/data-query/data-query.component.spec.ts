import { fakeAsync, tick } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuTrigger } from '@angular/material/menu';
import { of, throwError } from 'rxjs';

import { BuiltinModules, DataQueryConfig } from '../../core/config/data-query.config';
import { AuthService } from '../../core/services/auth.service';
import { DataQueryComponent } from './data-query.component';
import { LargeTextCellRendererComponent, LargeTextValueDialogComponent } from './large-text-cell-renderer.component';
import { QueryCondition } from '../../shared/components/query-builder/query-builder.component';

describe('DataQueryComponent', () => {
  let http: jasmine.SpyObj<HttpClient>;
  let dialog: jasmine.SpyObj<MatDialog>;
  let component: DataQueryComponent;
  let emailSettingsTrigger: jasmine.SpyObj<MatMenuTrigger>;
  let changeDetectorRef: jasmine.SpyObj<ChangeDetectorRef>;

  beforeEach(() => {
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['get', 'post']);
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    changeDetectorRef = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck']);

    component = createComponent(http, dialog, 'alice@example.com', changeDetectorRef);
    emailSettingsTrigger = jasmine.createSpyObj<MatMenuTrigger>('MatMenuTrigger', ['openMenu', 'closeMenu']);

    component.config = BuiltinModules['xms'];
    component.queryTabs = [
      {
        title: 'All Data',
        dataSource: [
          {
            id: 1,
            tradeType: 'Spot'
          }
        ],
        colDefs: component.config.colDefs
      }
    ];
    component.selectedTabIndex = 0;
    component.gridApi = {
      getSelectedNodes: jasmine.createSpy().and.returnValue([]),
      getDisplayedRowCount: jasmine.createSpy().and.returnValue(1)
    };
    component.emailSettingsTrigger = emailSettingsTrigger;
  });

  it('shows inline feedback when export is triggered without selected rows', () => {
    component.exportSelectedRowsAndSendEmail();

    expect(http.post).not.toHaveBeenCalled();
    expect(component.exportFeedback).toEqual({
      tone: 'error',
      message: 'Select at least one row from the current result before exporting.'
    });
  });

  it('shows the selected-row count directly in the export button label', () => {
    component.selectedRowCount = 3;

    expect(component.exportActionLabel).toBe('Download and Send (3 rows selected)');
  });

  it('tracks email settings menu open and close state', () => {
    expect(component.isEmailConfigOpen).toBeFalse();

    component.onEmailSettingsMenuOpened();
    expect(component.isEmailConfigOpen).toBeTrue();

    component.onEmailSettingsMenuClosed();
    expect(component.isEmailConfigOpen).toBeFalse();
  });

  it('uses the detached renderer for large text cell values', () => {
    const colDefs = (component as any).withReadableHeaders([{ field: 'description', headerName: 'Description' }]);
    const rendererSelector = colDefs[0].cellRendererSelector;
    const largeValue = 'word '.repeat(120);

    expect(rendererSelector?.({ value: largeValue, colDef: colDefs[0] } as any)?.component).toBe(
      LargeTextCellRendererComponent
    );
    expect(rendererSelector?.({ value: 'short value', colDef: colDefs[0] } as any)).toBeUndefined();
  });

  it('opens a detached dialog for the full large text value', () => {
    const renderer = new LargeTextCellRendererComponent(dialog);
    const value = 'word '.repeat(120).trim();
    const stopPropagation = jasmine.createSpy('stopPropagation');

    renderer.agInit({
      value,
      colDef: { field: 'description', headerName: 'Description' }
    } as any);
    renderer.openDialog({ stopPropagation } as unknown as MouseEvent);

    expect(stopPropagation).toHaveBeenCalled();
    expect(renderer.previewText.endsWith('…')).toBeTrue();
    expect(dialog.open).toHaveBeenCalledWith(
      LargeTextValueDialogComponent,
      jasmine.objectContaining({
        data: jasmine.objectContaining({
          fieldLabel: 'Description',
          value,
          characterCount: value.length,
          wordCount: 120
        })
      })
    );
  });

  it('shows inline feedback when no export format is selected', () => {
    component.gridApi.getSelectedNodes.and.returnValue([
      {
        data: {
          id: 1,
          tradeType: 'Spot'
        }
      }
    ]);
    component.exportCsvSelected = false;
    component.exportXlsxSelected = false;

    component.exportSelectedRowsAndSendEmail();

    expect(http.post).not.toHaveBeenCalled();
    expect(component.isEmailConfigOpen).toBeTrue();
    expect(emailSettingsTrigger.openMenu).toHaveBeenCalled();
    expect(component.exportFeedback).toEqual({
      tone: 'error',
      message: 'Select at least one file format before downloading or emailing the export.'
    });
  });

  it('shows inline feedback when the sender email cannot be determined', () => {
    component = createComponent(http, dialog, undefined);

    component.config = BuiltinModules['xms'];
    component.queryTabs = [
      {
        title: 'All Data',
        dataSource: [
          {
            id: 1,
            tradeType: 'Spot'
          }
        ],
        colDefs: component.config.colDefs
      }
    ];
    component.selectedTabIndex = 0;
    component.gridApi = {
      getSelectedNodes: jasmine.createSpy().and.returnValue([
        {
          data: {
            id: 1,
            tradeType: 'Spot'
          }
        }
      ]),
      getDisplayedRowCount: jasmine.createSpy().and.returnValue(1)
    };
    component.exportEmailInput = 'bob@example.com';

    component.exportSelectedRowsAndSendEmail();

    expect(http.post).not.toHaveBeenCalled();
    expect(component.exportFeedback).toEqual({
      tone: 'error',
      message: 'Your account email is unavailable, so the export sender address cannot be determined.'
    });
  });

  it('opens email settings when export is triggered with no valid custom recipient', () => {
    component.gridApi.getSelectedNodes.and.returnValue([
      {
        data: {
          id: 1,
          tradeType: 'Spot'
        }
      }
    ]);
    component.exportEmailInput = 'not-an-email';

    component.exportSelectedRowsAndSendEmail();

    expect(http.post).not.toHaveBeenCalled();
    expect(component.isEmailConfigOpen).toBeTrue();
    expect(emailSettingsTrigger.openMenu).toHaveBeenCalled();
    expect(component.exportFeedback).toEqual({
      tone: 'error',
      message: 'Add at least one valid recipient email before sending the export.'
    });
  });

  it('uses the current user email when the recipient field is blank', async () => {
    component.gridApi.getSelectedNodes.and.returnValue([
      {
        data: {
          id: 1,
          tradeType: 'Spot'
        }
      }
    ]);

    spyOn<any>(component, 'downloadBlob');
    spyOn<any>(component, 'blobToBase64').and.resolveTo('encoded-file');
    http.post.and.returnValue(of({ status: 200, body: '{"deliveryMode":"log-only"}' }));

    component.exportSelectedRowsAndSendEmail();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(emailSettingsTrigger.closeMenu).toHaveBeenCalled();
    expect(http.post).toHaveBeenCalledWith(
      `${component.config.apiEndpoint}/export/email`,
      jasmine.objectContaining({
        to: ['alice@example.com'],
        from: 'alice@example.com',
        cc: [],
        attachments: [
          jasmine.objectContaining({
            fileBase64: 'encoded-file'
          })
        ]
      })
    );
    const requestOptions = http.post.calls.mostRecent().args[2] as { observe: string; responseType: string };
    expect(requestOptions.observe).toBe('response');
    expect(requestOptions.responseType).toBe('text');
    expect(component.exportFeedback).toEqual({
      tone: 'success',
      message:
        'CSV downloaded and export email accepted for 1 recipient. Email delivery is running in local log-only mode.'
    });
  });

  it('marks the export view for refresh when the email request completes', async () => {
    component.gridApi.getSelectedNodes.and.returnValue([
      {
        data: {
          id: 1,
          tradeType: 'Spot'
        }
      }
    ]);
    spyOn<any>(component, 'downloadBlob');
    spyOn<any>(component, 'blobToBase64').and.resolveTo('encoded-file');
    http.post.and.returnValue(of({ status: 202, body: null }));

    const exportPromise = component.exportSelectedRowsAndSendEmail();

    expect(component.isExporting).toBeTrue();
    changeDetectorRef.markForCheck.calls.reset();

    await exportPromise;

    expect(component.isExporting).toBeFalse();
    expect(component.exportFeedback).toEqual({
      tone: 'success',
      message: 'CSV downloaded and export email accepted for 1 recipient.'
    });
    expect(changeDetectorRef.markForCheck).toHaveBeenCalled();
  });

  it('downloads and sends both csv and xlsx attachments when both formats are selected', async () => {
    component.gridApi.getSelectedNodes.and.returnValue([
      {
        data: {
          id: 1,
          tradeType: 'Spot'
        }
      }
    ]);
    component.exportXlsxSelected = true;

    const downloadBlobSpy = spyOn<any>(component, 'downloadBlob');
    spyOn<any>(component, 'blobToBase64').and.resolveTo('encoded-file');
    http.post.and.returnValue(of({ status: 200, body: '{"status":"accepted","deliveryMode":"log-only"}' }));

    component.exportSelectedRowsAndSendEmail();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(downloadBlobSpy).toHaveBeenCalledTimes(2);
    expect(emailSettingsTrigger.closeMenu).toHaveBeenCalled();
    expect(http.post).toHaveBeenCalledWith(
      `${component.config.apiEndpoint}/export/email`,
      jasmine.objectContaining({
        to: ['alice@example.com'],
        from: 'alice@example.com',
        cc: [],
        attachments: [
          jasmine.objectContaining({ fileName: jasmine.stringMatching(/\.csv$/) }),
          jasmine.objectContaining({ fileName: jasmine.stringMatching(/\.xlsx$/) })
        ]
      })
    );
    const requestOptions = http.post.calls.mostRecent().args[2] as { observe: string; responseType: string };
    expect(requestOptions.observe).toBe('response');
    expect(requestOptions.responseType).toBe('text');
    expect(component.exportFeedback).toEqual({
      tone: 'success',
      message:
        'CSV and XLSX downloaded and export email accepted for 1 recipient. Email delivery is running in local log-only mode.'
    });
  });

  it('builds user-friendly export file names', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-04-23T08:15:00.000Z'));

    const fileBaseName = (component as any).buildExportFileBaseName('All Data / Spot');

    expect(fileBaseName).toBe('All-Data-Spot-export-2026-04-23-0815');

    jasmine.clock().uninstall();
  });

  it('builds dropdown options from the initialized dataset', fakeAsync(() => {
    http.get.and.returnValue(
      of([
        { id: 1, tradeType: 'SPOT', currency: 'USD' },
        { id: 2, tradeType: 'FORWARD', currency: 'EUR' },
        { id: 3, tradeType: 'SPOT', currency: 'USD' }
      ])
    );

    const dropdownComponent = createComponent(http, dialog);
    dropdownComponent.config = createConfig();

    dropdownComponent.ngOnInit();
    tick();

    expect(dropdownComponent.dropdownOptions['tradeType']).toEqual(['FORWARD', 'SPOT']);
    expect(dropdownComponent.dropdownOptions['currency']).toEqual(['EUR', 'USD']);
    expect(dropdownComponent.availableFilterFields.find(field => field.name === 'tradeType')?.dropdownOptions).toEqual([
      { label: 'FORWARD', value: 'FORWARD' },
      { label: 'SPOT', value: 'SPOT' }
    ]);
    expect(dropdownComponent.queryTabs[0].title).toBe('All Data');
    expect(dropdownComponent.queryTabs[0].dataSource.length).toBe(3);
  }));

  it('falls back to mock data when the initial request fails', fakeAsync(() => {
    http.get.and.returnValue(throwError(() => new Error('backend unavailable')));

    const dropdownComponent = createComponent(http, dialog);
    dropdownComponent.config = createConfig({
      mockData: [
        { id: 1, tradeType: 'SPOT', currency: 'USD', tradeDate: '2026-01-01' },
        { id: 2, tradeType: 'SWAP', currency: 'JPY', tradeDate: '2026-01-02' }
      ]
    });

    dropdownComponent.ngOnInit();
    tick();

    expect(dropdownComponent.allData).toEqual(dropdownComponent.config.mockData ?? []);
    expect(dropdownComponent.dropdownOptions['tradeType']).toEqual(['SPOT', 'SWAP']);
    expect(dropdownComponent.queryTabs[0].title).toBe('All Data (Mock)');
  }));

  it('uses comma-separated IN conditions during local fallback filtering', fakeAsync(() => {
    http.post.and.returnValue(throwError(() => new Error('query failed')));

    const dropdownComponent = createComponent(http, dialog);
    dropdownComponent.config = createConfig();
    dropdownComponent.colDefs = [];
    dropdownComponent.allData = [
      { id: 1, tradeType: 'SPOT', currency: 'USD' },
      { id: 2, tradeType: 'FORWARD', currency: 'EUR' },
      { id: 3, tradeType: 'SWAP', currency: 'USD' }
    ];

    const conditions: QueryCondition[] = [
      {
        field: 'tradeType',
        operator: 'IN',
        value: 'SPOT,SWAP'
      }
    ];

    dropdownComponent.onQuerySubmit(conditions);
    tick();

    expect(dropdownComponent.queryTabs[0].title).toContain('tradeType IN SPOT,SWAP');
    expect(dropdownComponent.queryTabs[0].title).toContain('(Local)');
    expect(dropdownComponent.queryTabs[0].dataSource).toEqual([
      { id: 1, tradeType: 'SPOT', currency: 'USD' },
      { id: 3, tradeType: 'SWAP', currency: 'USD' }
    ]);
  }));
});

function createComponent(
  http: jasmine.SpyObj<HttpClient>,
  dialog: jasmine.SpyObj<MatDialog>,
  email?: string,
  changeDetectorRef = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck'])
): DataQueryComponent {
  const resolvedEmail = arguments.length < 3 ? 'alice@example.com' : email;
  return new DataQueryComponent(
    http,
    dialog,
    {
      currentUserValue: {
        email: resolvedEmail
      }
    } as AuthService,
    changeDetectorRef
  );
}

function createConfig(overrides: Partial<DataQueryConfig> = {}): DataQueryConfig {
  return {
    id: 'xms',
    name: 'XMS Module',
    description: 'Query trades',
    bgStyle: 'linear-gradient(135deg, #1b539c 0%, #089fd1 100%)',
    logo: 'XMS',
    authorization: {
      permissions: ['module:xms:read'],
      match: 'all'
    },
    apiEndpoint: '/api/user/trades',
    metricEndpoint: '/api/user/trades/metric',
    filterFields: [
      { name: 'tradeType', label: 'Trade Type', type: 'dropdown', mockOptions: ['SPOT'] },
      { name: 'currency', label: 'Currency', type: 'dropdown' },
      { name: 'tradeDate', label: 'Trade Date', type: 'date' }
    ],
    numericColumns: ['amount', 'id'],
    groupByFields: ['tradeType', 'currency'],
    colDefs: [],
    ...overrides
  };
}

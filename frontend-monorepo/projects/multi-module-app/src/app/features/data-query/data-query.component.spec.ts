import { HttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuTrigger } from '@angular/material/menu';
import { of } from 'rxjs';

import { BuiltinModules } from '../../core/config/data-query.config';
import { AuthService } from '../../core/services/auth.service';
import { DataQueryComponent } from './data-query.component';

describe('DataQueryComponent', () => {
  let http: jasmine.SpyObj<HttpClient>;
  let dialog: jasmine.SpyObj<MatDialog>;
  let component: DataQueryComponent;
  let emailSettingsTrigger: jasmine.SpyObj<MatMenuTrigger>;

  beforeEach(() => {
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['get', 'post']);
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);

    component = new DataQueryComponent(http, dialog, {
      currentUserValue: {
        email: 'alice@example.com'
      }
    } as AuthService);
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
    component = new DataQueryComponent(http, dialog, {
      currentUserValue: {
        email: undefined
      }
    } as AuthService);

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
});

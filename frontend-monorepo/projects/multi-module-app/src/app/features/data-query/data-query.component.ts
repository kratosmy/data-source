import { Component, OnInit, ViewChild, Inject, Input } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ColDef,
  GridReadyEvent,
  CellContextMenuEvent,
  ModuleRegistry,
  AllCommunityModule,
  RowSelectionOptions,
  SelectionColumnDef
} from 'ag-grid-community';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';

// Register AG Grid Modules
ModuleRegistry.registerModules([AllCommunityModule]);
import { MatMenuTrigger } from '@angular/material/menu';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { DataQueryConfig } from '../../core/config/data-query.config';
import { AuthService } from '../../core/services/auth.service';
import { QueryCondition } from '../../shared/components/query-builder/query-builder.component';

export interface QueryTab {
  title: string;
  dataSource: any[];
  colDefs?: ColDef[];
}

interface ExportFeedback {
  tone: 'success' | 'error';
  message: string;
}

type ExportFormat = 'csv' | 'xlsx';

interface ExportAttachmentPayload {
  fileName: string;
  contentType: string;
  fileBase64: string;
}

interface ExportEmailPayload {
  to: string[];
  from: string;
  cc: string[];
  attachments: ExportAttachmentPayload[];
}

interface PreparedExportFile {
  format: ExportFormat;
  fileName: string;
  contentType: string;
  blob: Blob;
}

interface ExportEmailResponse {
  status?: string;
  deliveryMode?: 'log-only' | 'smtp';
  recipientCount?: number;
  attachmentCount?: number;
  message?: string;
}

interface ExportEmailHttpResponse {
  status: number;
  body: string | null;
}

@Component({
  standalone: false,
  selector: 'app-aggregation-dialog',
  template: `
    <h2 mat-dialog-title>Aggregate Data</h2>
    <mat-dialog-content style="display: flex; flex-direction: column; gap: 16px; padding-top: 16px;">
      <mat-form-field appearance="outline">
        <mat-label>Group By Fields</mat-label>
        <mat-select [(ngModel)]="data.groupBy" multiple>
          <mat-option *ngFor="let col of data.columns" [value]="col">{{ col }}</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Aggregate Field</mat-label>
        <mat-select [(ngModel)]="data.aggregateField">
          <mat-option *ngFor="let col of data.numericColumns" [value]="col">{{ col }}</mat-option>
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [mat-dialog-close]="data">Aggregate</button>
    </mat-dialog-actions>
  `
})
export class AggregationDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<AggregationDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: { columns: string[]; numericColumns: string[]; groupBy: string[]; aggregateField: string }
  ) {}
}

@Component({
  standalone: false,
  selector: 'app-data-query',
  templateUrl: './data-query.component.html',
  styleUrl: './data-query.component.scss'
})
export class DataQueryComponent implements OnInit {
  private static readonly minColumnWidth = 140;
  private static readonly autoSizeColumnLimit = 8;
  private static readonly estimatedHeaderCharacterWidth = 10;
  private static readonly estimatedHeaderPadding = 48;
  private static readonly maxEstimatedColumnWidth = 320;
  private static readonly emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly csvContentType = 'text/csv;charset=utf-8;';
  private static readonly xlsxContentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  @Input() config!: DataQueryConfig;

  displayedColumns: string[] = [];
  colDefs: ColDef[] = [];
  defaultColDef: ColDef = {
    minWidth: DataQueryComponent.minColumnWidth,
    sortable: true,
    filter: true,
    floatingFilter: true, // Shows individual column filter input row
    resizable: true,
    wrapHeaderText: true,
    autoHeaderHeight: true
  };
  readonly rowSelection: RowSelectionOptions = {
    mode: 'multiRow',
    checkboxes: true,
    headerCheckbox: true
  };
  readonly selectionColumnDef: SelectionColumnDef = {
    width: 56,
    minWidth: 56,
    maxWidth: 56,
    pinned: 'left',
    suppressHeaderMenuButton: true,
    resizable: false,
    sortable: false
  };
  allData: any[] = [];
  queryTabs: QueryTab[] = [];
  selectedTabIndex = 0;
  tabCounter = 1;
  exportEmailInput = '';
  exportCsvSelected = true;
  exportXlsxSelected = false;
  isEmailConfigOpen = false;
  isExporting = false;
  selectedRowCount = 0;
  visibleRowCount = 0;
  exportFeedback: ExportFeedback | null = null;

  @ViewChild('contextMenuTrigger') contextMenu!: MatMenuTrigger;
  @ViewChild('emailSettingsTrigger') emailSettingsTrigger?: MatMenuTrigger;
  contextMenuPosition = { x: '0px', y: '0px' };

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private authService: AuthService
  ) {}

  ngOnInit() {
    if (!this.config) {
      console.warn('DataQueryComponent initialized without config');
      return;
    }

    this.colDefs = this.withReadableHeaders(this.config.colDefs);
    this.displayedColumns = this.config.colDefs.map(c => c.field).filter(f => !!f) as string[];

    // Create an initial loading tab
    this.queryTabs.push({
      title: 'All Data (Loading...)',
      dataSource: [],
      colDefs: this.colDefs
    });

    // Fetch initial data from backend API
    this.http.get<any[]>(this.config.apiEndpoint).subscribe({
      next: data => {
        this.allData = data || [];
        setTimeout(() => {
          this.queryTabs[0].title = 'All Data';
          this.queryTabs[0].dataSource = this.allData;
          if (this.gridApi) {
            this.gridApi.setGridOption('rowData', this.allData);
            this.scheduleColumnAutoSize();
          }
          this.syncExportContext();
        });
      },
      error: err => {
        console.error('Failed to load initial data', err);
        setTimeout(() => {
          this.queryTabs[0].title = 'Error Loading Data';
          this.syncExportContext();
        });
      }
    });
  }

  onQuerySubmit(conditions: QueryCondition[]) {
    this.clearExportFeedback();
    if (!Array.isArray(conditions)) {
      conditions = [];
    }
    const criteria = conditions.map(c => `${c.field} ${c.operator} ${c.value}`);
    const title = criteria.length > 0 ? criteria.join(', ') : `Query ${this.tabCounter}`;
    this.tabCounter++;

    // Create a loading tab first
    this.queryTabs.push({
      title: title + ' (Loading...)',
      dataSource: [],
      colDefs: this.colDefs
    });
    const newTabIndex = this.queryTabs.length - 1;
    this.selectedTabIndex = newTabIndex;

    // POST query conditions to backend
    const queryPayload = { conditions };

    this.http.post<any[]>(this.config.apiEndpoint + '/query', queryPayload).subscribe({
      next: data => {
        const result = data || [];
        setTimeout(() => {
          this.queryTabs[newTabIndex].title = title;
          this.queryTabs[newTabIndex].dataSource = result;
          if (this.gridApi && this.selectedTabIndex === newTabIndex) {
            this.gridApi.setGridOption('rowData', result);
            this.scheduleColumnAutoSize();
          }
          this.syncExportContext();
        });
      },
      error: err => {
        console.warn('Backend query failed, falling back to local filtering.', err);
        // Fallback: Local filtering on cached allData
        const filtered = this.allData.filter(row => {
          for (const cond of conditions) {
            if (cond.field === '_keyword_') {
              // Simple Search: match any field
              const keyword = String(cond.value).toLowerCase();
              const hasMatch = Object.values(row).some(v => String(v).toLowerCase().indexOf(keyword) !== -1);
              if (!hasMatch) return false;
              continue; // If it matched, check next condition
            }

            const val = row[cond.field];
            if (cond.operator === '=' && val != cond.value) return false;
            if (cond.operator === '!=' && val == cond.value) return false;
            if (cond.operator === '>' && val <= cond.value) return false;
            if (cond.operator === '<' && val >= cond.value) return false;
            if (cond.operator === '>=' && val < cond.value) return false;
            if (cond.operator === '<=' && val > cond.value) return false;
            if (cond.operator === 'LIKE' && String(val).toLowerCase().indexOf(String(cond.value).toLowerCase()) === -1)
              return false;
            if (cond.operator === 'IN') {
              const list = String(cond.value)
                .split(',')
                .map(s => s.trim());
              if (!list.includes(String(val))) return false;
            }
          }
          return true;
        });

        setTimeout(() => {
          this.queryTabs[newTabIndex].title = title + ' (Local)';
          this.queryTabs[newTabIndex].dataSource = filtered;
          if (this.gridApi && this.selectedTabIndex === newTabIndex) {
            this.gridApi.setGridOption('rowData', filtered);
            this.scheduleColumnAutoSize();
          }
          this.syncExportContext();
        });
      }
    });
  }

  onContextMenu(event: CellContextMenuEvent) {
    if (event.event) {
      event.event.preventDefault();
      this.contextMenuPosition.x = (event.event as MouseEvent).clientX + 'px';
      this.contextMenuPosition.y = (event.event as MouseEvent).clientY + 'px';
      setTimeout(() => {
        this.contextMenu.openMenu();
      }, 0);
    }
  }

  openAggregateDialog() {
    const dialogRef = this.dialog.open(AggregationDialogComponent, {
      width: '400px',
      data: {
        columns: this.displayedColumns,
        numericColumns: this.config.numericColumns || [],
        groupBy: this.config.groupByFields || [],
        aggregateField: this.config.numericColumns?.[0] || ''
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.aggregateData(result.groupBy, result.aggregateField);
      }
    });
  }

  aggregateData(groupBy: string[], aggregateField: string) {
    if (this.queryTabs.length === 0 || !groupBy || groupBy.length === 0) return;

    // Get the current visible data
    let currentData = this.queryTabs[this.selectedTabIndex].dataSource;
    let titlePrefix = 'Agg';

    if (this.gridApi) {
      const selectedNodes = this.gridApi.getSelectedNodes();
      if (selectedNodes && selectedNodes.length > 0) {
        currentData = selectedNodes.map((node: any) => node.data);
        titlePrefix = 'Sel. Agg';
      } else {
        const rowData: any[] = [];
        this.gridApi.forEachNodeAfterFilter((node: any) => rowData.push(node.data));
        currentData = rowData.length > 0 ? rowData : currentData;
      }
    }

    // Perform grouping and aggregation
    const map = new Map<string, { sum: number; keys: any }>();
    currentData.forEach(trade => {
      const keysObj: any = {};
      groupBy.forEach(g => (keysObj[g] = (trade as any)[g]));
      const keyString = JSON.stringify(keysObj);
      const val = Number((trade as any)[aggregateField]) || 0;

      const existing = map.get(keyString);
      if (existing) {
        existing.sum += val;
      } else {
        map.set(keyString, { sum: val, keys: keysObj });
      }
    });

    // Create a new data source based on aggregated results
    const aggregatedData: any[] = [];
    let idCounter = 1;
    map.forEach(value => {
      const newEntity: any = {
        id: idCounter++,
        ...value.keys
      };
      newEntity[aggregateField] = value.sum;
      aggregatedData.push(newEntity);
    });

    const aggColDefs: ColDef[] = groupBy.map(g => ({
      field: g,
      headerName: this.colDefs.find(c => c.field === g)?.headerName || g,
      filter: 'agTextColumnFilter',
      maxWidth: 350
    }));

    aggColDefs.push({
      field: aggregateField,
      headerName: `Sum of ${this.colDefs.find(c => c.field === aggregateField)?.headerName || aggregateField}`,
      filter: 'agNumberColumnFilter',
      type: 'numericColumn',
      maxWidth: 350,
      valueFormatter: (params: any) => (params.value != null ? Number(params.value).toLocaleString() : '')
    });

    this.tabCounter++;
    this.queryTabs.push({
      title: `${titlePrefix}: sum(${aggregateField}) by ${groupBy.join(', ')}`,
      dataSource: aggregatedData,
      colDefs: this.withReadableHeaders(aggColDefs)
    });
    this.selectTab(this.queryTabs.length - 1);
  }

  selectTab(index: number) {
    this.selectedTabIndex = index;
    this.clearExportFeedback();
    const tab = this.queryTabs[index];
    if (this.gridApi && tab) {
      this.gridApi.setGridOption('columnDefs', tab.colDefs || this.colDefs);
      this.gridApi.setGridOption('rowData', tab.dataSource);
      this.scheduleColumnAutoSize();
    }
    this.syncExportContext();
  }

  gridApi: any;
  onGridReady(params: GridReadyEvent, tabIndex: number) {
    this.gridApi = params.api;
    // Set initial row data for the first tab
    const currentTab = this.queryTabs[tabIndex];
    if (currentTab && currentTab.dataSource.length > 0) {
      this.gridApi.setGridOption('rowData', currentTab.dataSource);
    }

    this.scheduleColumnAutoSize();
    this.syncExportContext();
  }

  onSelectionChanged() {
    this.clearExportFeedback();
    this.syncExportContext();
  }

  onGridFilterChanged() {
    this.syncExportContext();
  }

  applyTabFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    if (this.gridApi) {
      this.gridApi.setGridOption('quickFilterText', filterValue);
      setTimeout(() => {
        this.syncExportContext();
      });
    }
  }

  closeTab(index: number, event: Event) {
    event.stopPropagation();
    this.clearExportFeedback();
    this.queryTabs.splice(index, 1);

    if (this.selectedTabIndex === index) {
      const newIndex = Math.max(0, index - 1);
      this.selectTab(newIndex);
    } else if (this.selectedTabIndex > index) {
      this.selectedTabIndex--;
    }

    this.syncExportContext();
  }

  onEmailSettingsMenuOpened() {
    this.isEmailConfigOpen = true;
  }

  onEmailSettingsMenuClosed() {
    this.isEmailConfigOpen = false;
  }

  onReset() {
    // If you need specific reset behavior for forms, implement it here or via ViewChild queryBuilder
  }

  onExportEmailInputChange() {
    this.clearExportFeedback();
  }

  clearExportEmailInput() {
    this.exportEmailInput = '';
    this.clearExportFeedback();
  }

  onExportFormatChange() {
    this.clearExportFeedback();
  }

  toggleExportFormat(format: ExportFormat) {
    if (format === 'csv') {
      this.exportCsvSelected = !this.exportCsvSelected;
    } else {
      this.exportXlsxSelected = !this.exportXlsxSelected;
    }
    this.onExportFormatChange();
  }

  get defaultRecipientEmail(): string {
    return this.authService.currentUserValue?.email?.trim() ?? '';
  }

  get exportEmailPlaceholder(): string {
    return this.defaultRecipientEmail ? 'Add recipients or leave blank' : 'Add recipients';
  }

  get selectedExportFormats(): ExportFormat[] {
    const formats: ExportFormat[] = [];

    if (this.exportCsvSelected) {
      formats.push('csv');
    }

    if (this.exportXlsxSelected) {
      formats.push('xlsx');
    }

    return formats;
  }

  get exportFormatSummary(): string {
    if (this.selectedExportFormats.length === 0) {
      return 'No file format selected';
    }

    return this.describeExportFormats(this.selectedExportFormats);
  }

  get exportRecipientSummary(): string {
    if (this.exportEmailInput.trim()) {
      const validRecipients = this.typedRecipientPreviewEmails.length;
      if (validRecipients > 0) {
        return `${validRecipients} custom ${validRecipients === 1 ? 'recipient' : 'recipients'} ready`;
      }

      return 'No valid custom recipients yet';
    }

    if (this.defaultRecipientEmail) {
      return 'Using your account email';
    }

    return 'No recipient configured';
  }

  get exportActionLabel(): string {
    if (this.isExporting) {
      return 'Sending export...';
    }

    return `Download and Send (${this.selectedRowCount} ${this.selectedRowCount === 1 ? 'row' : 'rows'} selected)`;
  }

  get typedRecipientPreviewEmails(): string[] {
    return this.parseRecipientEmails(this.exportEmailInput);
  }

  get invalidRecipientCount(): number {
    if (!this.exportEmailInput.trim()) {
      return 0;
    }

    return this.parseRecipientTokens(this.exportEmailInput).filter(
      email => !DataQueryComponent.emailPattern.test(email)
    ).length;
  }

  get isUsingDefaultRecipient(): boolean {
    return !this.exportEmailInput.trim() && !!this.defaultRecipientEmail;
  }

  get exportSelectionSummary(): string {
    if (this.visibleRowCount === 0) {
      return 'No rows available in this result';
    }

    return `${this.selectedRowCount} selected of ${this.visibleRowCount} visible`;
  }

  async exportSelectedRowsAndSendEmail() {
    this.clearExportFeedback();
    if (this.isExporting || !this.gridApi || !this.queryTabs[this.selectedTabIndex]) {
      return;
    }

    const selectedRows = this.getSelectedRows();

    if (selectedRows.length === 0) {
      this.setExportFeedback('error', 'Select at least one row from the current result before exporting.');
      return;
    }

    const recipientEmails = this.getEffectiveRecipientEmails();
    if (recipientEmails.length === 0) {
      this.openEmailSettingsMenu();
      this.setExportFeedback('error', 'Add at least one valid recipient email before sending the export.');
      return;
    }

    const senderEmail = this.defaultRecipientEmail;
    if (!senderEmail) {
      this.setExportFeedback(
        'error',
        'Your account email is unavailable, so the export sender address cannot be determined.'
      );
      return;
    }

    const selectedFormats = this.selectedExportFormats;
    if (selectedFormats.length === 0) {
      this.openEmailSettingsMenu();
      this.setExportFeedback('error', 'Select at least one file format before downloading or emailing the export.');
      return;
    }

    this.emailSettingsTrigger?.closeMenu();

    const activeTab = this.queryTabs[this.selectedTabIndex];
    const activeColDefs = activeTab.colDefs || this.colDefs;
    const fileBaseName = this.buildExportFileBaseName(activeTab.title || 'query-result');
    const preparedFiles = this.prepareExportFiles(selectedRows, activeColDefs, fileBaseName, selectedFormats);

    preparedFiles.forEach(file => this.downloadBlob(file.blob, file.fileName));

    this.isExporting = true;
    try {
      const attachments = await Promise.all(
        preparedFiles.map(async file => ({
          fileName: file.fileName,
          contentType: file.contentType,
          fileBase64: await this.blobToBase64(file.blob)
        }))
      );
      const payload: ExportEmailPayload = {
        to: recipientEmails,
        from: senderEmail,
        cc: [],
        attachments
      };

      const response = (await firstValueFrom(
        this.http.post(`${this.config.apiEndpoint}/export/email`, payload, {
          observe: 'response',
          responseType: 'text'
        })
      )) as ExportEmailHttpResponse;
      const responseBody = this.tryParseExportEmailResponse(response.body);
      const recipientLabel = recipientEmails.length === 1 ? 'recipient' : 'recipients';
      const downloadedFormats = this.describeExportFormats(selectedFormats);
      const deliveryMessage =
        responseBody?.deliveryMode === 'log-only' ? ' Email delivery is running in local log-only mode.' : '';
      this.setExportFeedback(
        'success',
        `${downloadedFormats} downloaded and export email accepted for ${recipientEmails.length} ${recipientLabel}.${deliveryMessage}`
      );
    } catch (error) {
      console.error('Failed to send export email', error);
      this.setExportFeedback(
        'error',
        'Selected files downloaded successfully, but sending the email request failed. Please try again.'
      );
    } finally {
      this.isExporting = false;
    }
  }

  private withReadableHeaders(columnDefs: ColDef[]): ColDef[] {
    return columnDefs.map(columnDef => {
      const minWidth = this.getPreferredMinWidth(columnDef);
      const preferredWidth = this.getPreferredWidth(columnDef, minWidth);

      return {
        ...columnDef,
        ...(preferredWidth != null ? { width: preferredWidth } : {}),
        minWidth,
        wrapHeaderText: columnDef.wrapHeaderText ?? true,
        autoHeaderHeight: columnDef.autoHeaderHeight ?? true,
        headerTooltip: columnDef.headerTooltip ?? columnDef.headerName ?? columnDef.field
      };
    });
  }

  private getSelectedRows(): any[] {
    return this.gridApi
      .getSelectedNodes()
      .map((node: { data: any }) => node.data)
      .filter((row: any) => !!row);
  }

  private getEffectiveRecipientEmails(): string[] {
    if (this.exportEmailInput.trim()) {
      return this.parseRecipientEmails(this.exportEmailInput);
    }

    return this.defaultRecipientEmail ? this.parseRecipientEmails(this.defaultRecipientEmail) : [];
  }

  private setExportFeedback(tone: ExportFeedback['tone'], message: string) {
    this.exportFeedback = { tone, message };
  }

  private clearExportFeedback() {
    this.exportFeedback = null;
  }

  private openEmailSettingsMenu() {
    this.isEmailConfigOpen = true;
    this.emailSettingsTrigger?.openMenu();
  }

  private syncExportContext() {
    const selectedNodes = this.gridApi?.getSelectedNodes?.() ?? [];
    const displayedRowCount = this.gridApi?.getDisplayedRowCount?.();

    this.selectedRowCount = selectedNodes.length;
    this.visibleRowCount =
      typeof displayedRowCount === 'number'
        ? displayedRowCount
        : (this.queryTabs[this.selectedTabIndex]?.dataSource.length ?? 0);
  }

  private parseRecipientTokens(rawEmails: string): string[] {
    return Array.from(
      new Set(
        (rawEmails || '')
          .split(/[,\s;]+/)
          .map(email => email.trim())
          .filter(email => email.length > 0)
      )
    );
  }

  private scheduleColumnAutoSize() {
    if (!this.gridApi) {
      return;
    }

    setTimeout(() => {
      const displayedColumns = this.gridApi?.getAllDisplayedColumns?.() ?? [];

      if (displayedColumns.length === 0) {
        return;
      }

      if (displayedColumns.length <= DataQueryComponent.autoSizeColumnLimit) {
        this.gridApi?.autoSizeColumns(displayedColumns, false);
        return;
      }

      this.gridApi?.refreshHeader();
    });
  }

  private getPreferredMinWidth(columnDef: ColDef): number {
    if (columnDef.minWidth != null) {
      return columnDef.minWidth;
    }

    if (columnDef.maxWidth != null) {
      return Math.min(DataQueryComponent.minColumnWidth, columnDef.maxWidth);
    }

    return DataQueryComponent.minColumnWidth;
  }

  private getPreferredWidth(columnDef: ColDef, minWidth: number): number | undefined {
    if (columnDef.flex != null || columnDef.width != null || columnDef.initialWidth != null) {
      return undefined;
    }

    const headerText = columnDef.headerName ?? columnDef.field;
    if (!headerText) {
      return minWidth;
    }

    const estimatedWidth =
      headerText.length * DataQueryComponent.estimatedHeaderCharacterWidth + DataQueryComponent.estimatedHeaderPadding;
    const maxWidth =
      columnDef.maxWidth != null
        ? Math.min(columnDef.maxWidth, DataQueryComponent.maxEstimatedColumnWidth)
        : DataQueryComponent.maxEstimatedColumnWidth;

    return Math.min(Math.max(estimatedWidth, minWidth), maxWidth);
  }

  private parseRecipientEmails(rawEmails: string): string[] {
    return this.parseRecipientTokens(rawEmails).filter(email => DataQueryComponent.emailPattern.test(email));
  }

  private prepareExportFiles(
    rows: any[],
    columns: ColDef[],
    fileBaseName: string,
    formats: ExportFormat[]
  ): PreparedExportFile[] {
    return formats.map(format => {
      if (format === 'xlsx') {
        return this.buildXlsxFile(rows, columns, fileBaseName);
      }

      return this.buildCsvFile(rows, columns, fileBaseName);
    });
  }

  private buildCsvFile(rows: any[], columns: ColDef[], fileBaseName: string): PreparedExportFile {
    const csvContent = this.buildCsvContent(rows, columns);

    return {
      format: 'csv',
      fileName: `${fileBaseName}.csv`,
      contentType: DataQueryComponent.csvContentType,
      blob: new Blob(['\ufeff' + csvContent], { type: DataQueryComponent.csvContentType })
    };
  }

  private buildXlsxFile(rows: any[], columns: ColDef[], fileBaseName: string): PreparedExportFile {
    const worksheet = XLSX.utils.aoa_to_sheet(this.buildWorksheetRows(rows, columns));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
    const workbookBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

    return {
      format: 'xlsx',
      fileName: `${fileBaseName}.xlsx`,
      contentType: DataQueryComponent.xlsxContentType,
      blob: new Blob([workbookBuffer], { type: DataQueryComponent.xlsxContentType })
    };
  }

  private buildWorksheetRows(rows: any[], columns: ColDef[]): unknown[][] {
    const fields = columns.map(column => column.field).filter((field): field is string => !!field);

    return [
      fields.map(field => this.resolveHeaderLabel(field, columns)),
      ...rows.map(row => fields.map(field => this.normalizeWorksheetCellValue(row[field])))
    ];
  }

  private buildCsvContent(rows: any[], columns: ColDef[]): string {
    const fields = columns.map(column => column.field).filter((field): field is string => !!field);
    const header = fields.map(field => this.escapeCsvValue(this.resolveHeaderLabel(field, columns))).join(',');
    const body = rows.map(row => fields.map(field => this.escapeCsvValue(row[field])).join(',')).join('\n');
    return `${header}\n${body}`;
  }

  private normalizeWorksheetCellValue(value: unknown): string | number | boolean {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    return String(value);
  }

  private resolveHeaderLabel(field: string, columns: ColDef[]): string {
    return columns.find(column => column.field === field)?.headerName || field;
  }

  private escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    const normalized = String(value).replace(/"/g, '""');
    return /[",\n]/.test(normalized) ? `"${normalized}"` : normalized;
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .trim()
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private buildExportFileBaseName(tabTitle: string): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10);
    const timePart = now.toISOString().slice(11, 16).replace(':', '');
    const normalizedTitle = this.sanitizeFileName(tabTitle || 'query-results');

    return `${normalizedTitle || 'query-results'}-export-${datePart}-${timePart}`;
  }

  private tryParseExportEmailResponse(responseBody: string | null): ExportEmailResponse | null {
    if (!responseBody) {
      return null;
    }

    try {
      return JSON.parse(responseBody) as ExportEmailResponse;
    } catch {
      return null;
    }
  }

  private describeExportFormats(formats: ExportFormat[]): string {
    const labels = formats.map(format => format.toUpperCase());

    if (labels.length <= 1) {
      return labels[0] ?? 'Export';
    }

    if (labels.length === 2) {
      return `${labels[0]} and ${labels[1]}`;
    }

    return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`;
  }

  private downloadBlob(blob: Blob, fileName: string) {
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(objectUrl);
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Failed to read blob as base64 string.'));
          return;
        }

        const base64 = result.split(',')[1];
        if (!base64) {
          reject(new Error('Missing base64 payload.'));
          return;
        }

        resolve(base64);
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to convert blob to base64.'));
      reader.readAsDataURL(blob);
    });
  }
}

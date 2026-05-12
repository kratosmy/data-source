import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';

interface LargeTextDialogData {
  fieldLabel: string;
  value: string;
  characterCount: number;
  wordCount: number;
}

@Component({
  standalone: false,
  selector: 'app-large-text-cell-renderer',
  templateUrl: './large-text-cell-renderer.component.html',
  styleUrl: './large-text-cell-renderer.component.scss'
})
export class LargeTextCellRendererComponent implements ICellRendererAngularComp {
  private static readonly previewLength = 180;

  fieldLabel = 'Field value';
  value = '';
  previewText = '';
  characterCount = 0;
  wordCount = 0;

  constructor(private dialog: MatDialog) {}

  agInit(params: ICellRendererParams): void {
    this.setParams(params);
  }

  refresh(params: ICellRendererParams): boolean {
    this.setParams(params);
    return true;
  }

  openDialog(event: MouseEvent): void {
    event.stopPropagation();

    this.dialog.open(LargeTextValueDialogComponent, {
      width: '900px',
      maxWidth: '96vw',
      maxHeight: '90vh',
      data: {
        fieldLabel: this.fieldLabel,
        value: this.value,
        characterCount: this.characterCount,
        wordCount: this.wordCount
      }
    });
  }

  private setParams(params: ICellRendererParams): void {
    this.value = this.normalizeValue(params.value);
    this.fieldLabel = params.colDef?.headerName ?? params.colDef?.field ?? 'Field value';
    this.previewText = this.buildPreview(this.value);
    this.characterCount = this.value.length;
    this.wordCount = this.countWords(this.value);
  }

  private normalizeValue(value: unknown): string {
    return value === null || value === undefined ? '' : String(value);
  }

  private buildPreview(value: string): string {
    const normalized = value.replace(/\s+/g, ' ').trim();

    if (normalized.length <= LargeTextCellRendererComponent.previewLength) {
      return normalized;
    }

    return `${normalized.slice(0, LargeTextCellRendererComponent.previewLength).trimEnd()}…`;
  }

  private countWords(value: string): number {
    const normalized = value.trim();

    return normalized ? normalized.split(/\s+/).length : 0;
  }
}

@Component({
  standalone: false,
  selector: 'app-large-text-value-dialog',
  template: `
    <h2 mat-dialog-title>{{ data.fieldLabel }}</h2>
    <mat-dialog-content class="large-text-dialog-content">
      <div class="large-text-dialog-meta">{{ wordCountLabel }} · {{ characterCountLabel }}</div>
      <pre class="large-text-dialog-value">{{ data.value }}</pre>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styleUrl: './large-text-cell-renderer.component.scss'
})
export class LargeTextValueDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: LargeTextDialogData) {}

  get wordCountLabel(): string {
    return `${this.data.wordCount} ${this.data.wordCount === 1 ? 'word' : 'words'}`;
  }

  get characterCountLabel(): string {
    return `${this.data.characterCount} ${this.data.characterCount === 1 ? 'character' : 'characters'}`;
  }
}

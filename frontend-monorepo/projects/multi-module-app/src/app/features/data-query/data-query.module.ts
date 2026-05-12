import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataQueryComponent, AggregationDialogComponent } from './data-query.component';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { AgGridAngular } from 'ag-grid-angular';
import { QueryBuilderComponent } from '../../shared/components/query-builder/query-builder.component';
import { LargeTextCellRendererComponent, LargeTextValueDialogComponent } from './large-text-cell-renderer.component';

@NgModule({
  declarations: [
    DataQueryComponent,
    AggregationDialogComponent,
    LargeTextCellRendererComponent,
    LargeTextValueDialogComponent
  ],
  imports: [
    CommonModule,
    AgGridAngular,
    MatTableModule,
    MatTabsModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatCheckboxModule,
    MatSelectModule,
    MatDialogModule,
    MatButtonModule,
    FormsModule,
    ReactiveFormsModule,
    QueryBuilderComponent
  ],
  exports: [DataQueryComponent]
})
export class DataQueryModule {}

import { ColDef } from 'ag-grid-community';

export type FilterFieldType = 'string' | 'number' | 'date' | 'time' | 'checkbox';

import { ModuleDefinition } from '../models/auth.models';

export interface FilterField {
  name: string;
  label: string;
  type: FilterFieldType;
  group?: string;
  gridSpan?: 3 | 4 | 6 | 12;
  placeholder?: string;
}

export interface DataQueryConfig extends ModuleDefinition {
  apiEndpoint: string;
  metricEndpoint: string;
  colDefs: ColDef[];
  filterFields: FilterField[];
  numericColumns: string[];
  groupByFields: string[];
}

const entityApiBasePath = '/api/user';

export const BuiltinModules: Record<string, DataQueryConfig> = {
  xms: {
    id: 'xms',
    name: 'XMS Module (Trades)',
    description: 'Query and view XMS Trades data.',
    bgStyle: 'linear-gradient(135deg, #1b539c 0%, #089fd1 100%)',
    logo: 'XMS',
    authorization: {
      permissions: ['module:xms:read'],
      match: 'all'
    },
    apiEndpoint: `${entityApiBasePath}/trades`,
    metricEndpoint: `${entityApiBasePath}/trades/metric`,
    filterFields: [
      { name: 'tradeType', label: 'Trade Type', type: 'string', group: 'Basic' },
      { name: 'currency', label: 'Currency', type: 'string', group: 'Basic' },
      { name: 'tradeDate', label: 'Trade Date', type: 'date', group: 'Time' },
      { name: 'counterparty', label: 'Counterparty', type: 'string', group: 'Counterparty' }
    ],
    numericColumns: ['amount', 'id'],
    groupByFields: ['tradeType', 'currency', 'counterparty'],
    colDefs: [
      {
        field: 'id',
        headerName: 'ID',
        filter: 'agNumberColumnFilter',
        maxWidth: 100
      },
      { field: 'tradeType', headerName: 'Trade Type', filter: 'agTextColumnFilter' },
      { field: 'tradeDate', headerName: 'Trade Date', filter: 'agDateColumnFilter' },
      {
        field: 'amount',
        headerName: 'Amount',
        filter: 'agNumberColumnFilter',
        type: 'numericColumn',
        valueFormatter: params => (params.value != null ? Number(params.value).toLocaleString() : '')
      },
      { field: 'currency', headerName: 'Currency', filter: 'agTextColumnFilter', maxWidth: 150 },
      { field: 'counterparty', headerName: 'Counterparty', filter: 'agTextColumnFilter' }
    ]
  },
  libra: {
    id: 'libra',
    name: 'Libra Module (Assets)',
    description: 'Query and view CryptoAssets data.',
    bgStyle: 'linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)',
    logo: 'LIB',
    authorization: {
      permissions: ['module:libra:read'],
      match: 'all'
    },
    apiEndpoint: `${entityApiBasePath}/cryptoassets`,
    metricEndpoint: `${entityApiBasePath}/cryptoassets/metric`,
    filterFields: [
      { name: 'symbol', label: 'Symbol', type: 'string', group: 'Basic' },
      { name: 'listingDate', label: 'Listing Date', type: 'date', group: 'Time' }
    ],
    numericColumns: ['marketCap', 'id'],
    groupByFields: ['symbol'],
    colDefs: [
      {
        field: 'id',
        headerName: 'ID',
        filter: 'agNumberColumnFilter',
        maxWidth: 100
      },
      { field: 'symbol', headerName: 'Symbol', filter: 'agTextColumnFilter' },
      {
        field: 'marketCap',
        headerName: 'Market Cap',
        filter: 'agNumberColumnFilter',
        type: 'numericColumn',
        valueFormatter: params => (params.value != null ? Number(params.value).toLocaleString() : '')
      },
      { field: 'listingDate', headerName: 'Listing Date', filter: 'agDateColumnFilter' }
    ]
  }
};

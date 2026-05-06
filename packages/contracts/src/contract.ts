import { transactionTypes, type TransactionType } from './transaction';

export const contractStatuses = ['active', 'inactive'] as const;

export const contractTypes = transactionTypes;

export type ContractStatus = (typeof contractStatuses)[number];
export type ContractType = TransactionType;

export interface ContractAdjustment {
  id: string;
  contractId: string;
  amountInCents: number;
  effectiveStartDate: string;
  createdAt: string;
}

export interface Contract {
  id: string;
  accountId: string;
  name: string;
  category: string;
  type: ContractType;
  amountInCents: number;
  dueDay: number;
  startDate: string;
  endDate?: string | null;
  status: ContractStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ContractListItem extends Contract {
  accountName: string;
  adjustments?: ContractAdjustment[];
}

export interface ContractsSnapshot {
  activeContracts: ContractListItem[];
  inactiveContracts: ContractListItem[];
  totalActiveIncomeInCents: number;
  totalActiveExpenseInCents: number;
  netActiveAmountInCents: number;
}

export interface CreateContractInput {
  accountId: string;
  name: string;
  category: string;
  type: ContractType;
  amountInCents: number;
  dueDay: number;
  startDate: string;
  status: ContractStatus;
}

export interface UpdateContractInput extends CreateContractInput {
  id: string;
}

export interface CreateContractAdjustmentInput {
  contractId: string;
  amountInCents: number;
  effectiveStartDate: string;
}

export interface EndContractInput {
  contractId: string;
  endDate: string;
}

export interface ProjectedContractOccurrence {
  id: string;
  contractId: string;
  contractName: string;
  accountId: string;
  accountName: string;
  category: string;
  type: ContractType;
  amountInCents: number;
  signedAmountInCents: number;
  occurrenceDate: string;
}

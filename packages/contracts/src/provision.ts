export const provisionStatuses = ['active', 'redeemed'] as const;

export type ProvisionStatus = (typeof provisionStatuses)[number];

export interface Provision {
  id: string;
  accountId: string;
  description: string;
  category: string;
  targetAmountInCents: number;
  startDate: string;
  targetDate: string;
  status: ProvisionStatus;
  redeemedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProvisionListItem extends Provision {
  accountName: string;
}

export interface ProvisionsSnapshot {
  activeProvisions: ProvisionListItem[];
  redeemedProvisions: ProvisionListItem[];
  totalActiveTargetAmountInCents: number;
}

export interface CreateProvisionInput {
  accountId: string;
  description: string;
  category: string;
  targetAmountInCents: number;
  startDate: string;
  targetDate: string;
}

export interface UpdateProvisionInput extends CreateProvisionInput {
  id: string;
}

export interface RedeemProvisionInput {
  provisionId: string;
  redeemedAt: string;
}

export type ProjectedProvisionOccurrenceKind = 'allocation' | 'release';

export interface ProjectedProvisionOccurrence {
  id: string;
  provisionId: string;
  accountId: string;
  accountName: string;
  description: string;
  category: string;
  amountInCents: number;
  occurrenceDate: string;
  kind: ProjectedProvisionOccurrenceKind;
}

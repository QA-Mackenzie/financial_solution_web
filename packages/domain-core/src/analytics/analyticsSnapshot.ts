import type {
  FinancialAnalyticsCategoryBreakdownItem,
  FinancialAnalyticsEntityBreakdownItem,
  FinancialAnalyticsMonthBreakdownItem,
  FinancialAnalyticsSnapshot,
  FinancialAnalyticsTagBreakdownItem,
  FinancialRecordFilter,
  FinancialRecordListItem,
  FinancialRecordQuerySnapshot,
} from '@economy-cash/contracts';
import { DEFAULT_UNCATEGORIZED_CATEGORY, normalizeCategoryLabel } from '@economy-cash/contracts';

const sanitizeFilters = (
  filters: FinancialRecordFilter = {},
): FinancialRecordFilter => ({
  ...filters,
  category: filters.category ? normalizeCategoryLabel(filters.category) : undefined,
});

export const filterFinancialRecords = (
  records: FinancialRecordListItem[],
  filters: FinancialRecordFilter = {},
): FinancialRecordListItem[] => {
  const sanitizedFilters = sanitizeFilters(filters);

  return records
    .filter((record) => {
      if (sanitizedFilters.accountId && record.accountId !== sanitizedFilters.accountId) {
        return false;
      }

      if (sanitizedFilters.category && record.category !== sanitizedFilters.category) {
        return false;
      }

      if (sanitizedFilters.entityId && record.entityId !== sanitizedFilters.entityId) {
        return false;
      }

      if (
        sanitizedFilters.entityKind &&
        record.entityKind !== sanitizedFilters.entityKind
      ) {
        return false;
      }

      if (sanitizedFilters.fromDate && record.occurrenceDate < sanitizedFilters.fromDate) {
        return false;
      }

      if (sanitizedFilters.recordKind && record.recordKind !== sanitizedFilters.recordKind) {
        return false;
      }

      if (
        sanitizedFilters.tagId &&
        !record.tags.some((tag) => tag.id === sanitizedFilters.tagId)
      ) {
        return false;
      }

      if (sanitizedFilters.toDate && record.occurrenceDate > sanitizedFilters.toDate) {
        return false;
      }

      if (sanitizedFilters.type && record.type !== sanitizedFilters.type) {
        return false;
      }

      return true;
    })
    .sort(
      (left, right) =>
        right.occurrenceDate.localeCompare(left.occurrenceDate) ||
        right.createdAt.localeCompare(left.createdAt) ||
        left.description.localeCompare(right.description),
    );
};

export const buildFinancialRecordQuerySnapshot = (
  records: FinancialRecordListItem[],
  filters: FinancialRecordFilter = {},
): FinancialRecordQuerySnapshot => {
  const appliedFilters = sanitizeFilters(filters);
  const filteredRecords = filterFinancialRecords(records, appliedFilters);
  const totalIncomeInCents = filteredRecords
    .filter((record) => record.type === 'income')
    .reduce((sum, record) => sum + record.amountInCents, 0);
  const totalExpenseInCents = filteredRecords
    .filter((record) => record.type === 'expense')
    .reduce((sum, record) => sum + record.amountInCents, 0);

  return {
    appliedFilters,
    recordCount: filteredRecords.length,
    totalExpenseInCents,
    totalIncomeInCents,
    records: filteredRecords,
  };
};

type AggregateBucket = {
  count: number;
  expenseInCents: number;
  incomeInCents: number;
};

const updateAggregateBucket = (bucket: AggregateBucket, record: FinancialRecordListItem) => {
  bucket.count += 1;

  if (record.type === 'income') {
    bucket.incomeInCents += record.amountInCents;
  } else {
    bucket.expenseInCents += record.amountInCents;
  }
};

const toNetAmountInCents = (bucket: Pick<AggregateBucket, 'expenseInCents' | 'incomeInCents'>) =>
  bucket.incomeInCents - bucket.expenseInCents;

export const buildFinancialAnalyticsSnapshot = (
  records: FinancialRecordListItem[],
  filters: FinancialRecordFilter = {},
): FinancialAnalyticsSnapshot => {
  const querySnapshot = buildFinancialRecordQuerySnapshot(records, filters);
  const categoryBuckets = new Map<string, AggregateBucket>();
  const entityBuckets = new Map<string, AggregateBucket & {
    entityId: string;
    entityKind: FinancialRecordListItem['entityKind'];
    entityName: string;
  }>();
  const monthBuckets = new Map<string, AggregateBucket>();
  const tagBuckets = new Map<string, AggregateBucket & { tagId: string; tagName: string }>();

  for (const record of querySnapshot.records) {
    const category = record.category || DEFAULT_UNCATEGORIZED_CATEGORY;
    const categoryBucket = categoryBuckets.get(category) ?? {
      count: 0,
      expenseInCents: 0,
      incomeInCents: 0,
    };

    updateAggregateBucket(categoryBucket, record);
    categoryBuckets.set(category, categoryBucket);

    const entityBucketKey = `${record.entityKind}:${record.entityId}`;
    const entityBucket = entityBuckets.get(entityBucketKey) ?? {
      count: 0,
      entityId: record.entityId,
      entityKind: record.entityKind,
      entityName: record.entityName,
      expenseInCents: 0,
      incomeInCents: 0,
    };

    updateAggregateBucket(entityBucket, record);
    entityBuckets.set(entityBucketKey, entityBucket);

    const monthStart = `${record.occurrenceDate.slice(0, 7)}-01`;
    const monthBucket = monthBuckets.get(monthStart) ?? {
      count: 0,
      expenseInCents: 0,
      incomeInCents: 0,
    };

    updateAggregateBucket(monthBucket, record);
    monthBuckets.set(monthStart, monthBucket);

    for (const tag of record.tags) {
      const tagBucket = tagBuckets.get(tag.id) ?? {
        count: 0,
        expenseInCents: 0,
        incomeInCents: 0,
        tagId: tag.id,
        tagName: tag.name,
      };

      updateAggregateBucket(tagBucket, record);
      tagBuckets.set(tag.id, tagBucket);
    }
  }

  const byCategory: FinancialAnalyticsCategoryBreakdownItem[] = [...categoryBuckets.entries()]
    .map(([category, bucket]) => ({
      category,
      count: bucket.count,
      expenseInCents: bucket.expenseInCents,
      incomeInCents: bucket.incomeInCents,
      netAmountInCents: toNetAmountInCents(bucket),
    }))
    .sort((left, right) =>
      Math.abs(right.netAmountInCents) - Math.abs(left.netAmountInCents) ||
      left.category.localeCompare(right.category),
    );

  const byEntity: FinancialAnalyticsEntityBreakdownItem[] = [...entityBuckets.values()]
    .map((bucket) => ({
      count: bucket.count,
      entityId: bucket.entityId,
      entityKind: bucket.entityKind,
      entityName: bucket.entityName,
      expenseInCents: bucket.expenseInCents,
      incomeInCents: bucket.incomeInCents,
      netAmountInCents: toNetAmountInCents(bucket),
    }))
    .sort((left, right) =>
      Math.abs(right.netAmountInCents) - Math.abs(left.netAmountInCents) ||
      left.entityName.localeCompare(right.entityName),
    );

  const byMonth: FinancialAnalyticsMonthBreakdownItem[] = [...monthBuckets.entries()]
    .map(([monthStart, bucket]) => ({
      count: bucket.count,
      expenseInCents: bucket.expenseInCents,
      incomeInCents: bucket.incomeInCents,
      monthStart,
      netAmountInCents: toNetAmountInCents(bucket),
    }))
    .sort((left, right) => left.monthStart.localeCompare(right.monthStart));

  const byTag: FinancialAnalyticsTagBreakdownItem[] = [...tagBuckets.values()]
    .map((bucket) => ({
      count: bucket.count,
      expenseInCents: bucket.expenseInCents,
      incomeInCents: bucket.incomeInCents,
      netAmountInCents: toNetAmountInCents(bucket),
      tagId: bucket.tagId,
      tagName: bucket.tagName,
    }))
    .sort((left, right) =>
      Math.abs(right.netAmountInCents) - Math.abs(left.netAmountInCents) ||
      left.tagName.localeCompare(right.tagName),
    );

  return {
    appliedFilters: querySnapshot.appliedFilters,
    byCategory,
    byEntity,
    byMonth,
    byTag,
    netAmountInCents: querySnapshot.totalIncomeInCents - querySnapshot.totalExpenseInCents,
    recordCount: querySnapshot.recordCount,
    totalExpenseInCents: querySnapshot.totalExpenseInCents,
    totalIncomeInCents: querySnapshot.totalIncomeInCents,
  };
};
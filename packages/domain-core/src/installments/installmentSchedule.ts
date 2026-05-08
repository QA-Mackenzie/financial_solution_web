import type {
  InstallmentOccurrenceListItem,
  InstallmentOperation,
  InstallmentPlanListItem,
  ProjectedInstallmentCreditCardPurchase,
  ProjectedInstallmentOccurrence,
} from '@economy-cash/contracts';

const getDaysInMonth = (year: number, monthIndex: number) =>
  new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

const toDateString = (year: number, monthIndex: number, day: number) => {
  const boundedDay = Math.min(day, getDaysInMonth(year, monthIndex));

  return `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-${String(
    boundedDay,
  ).padStart(2, '0')}`;
};

const getDateParts = (value: string) => {
  const reference = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(reference.valueOf())) {
    throw new Error('A data de referencia do parcelamento e invalida.');
  }

  return {
    year: reference.getUTCFullYear(),
    monthIndex: reference.getUTCMonth(),
    day: reference.getUTCDate(),
  };
};

const getCurrentMonthStart = (currentDate?: string) => {
  const { year, monthIndex } = getDateParts(
    currentDate ?? new Date().toISOString().slice(0, 10),
  );

  return toDateString(year, monthIndex, 1);
};

const shiftMonth = (date: string, delta: number) => {
  const { year, monthIndex, day } = getDateParts(date);
  const absoluteMonthIndex = monthIndex + delta;
  const nextYear = year + Math.floor(absoluteMonthIndex / 12);
  const nextMonthIndex = ((absoluteMonthIndex % 12) + 12) % 12;

  return toDateString(nextYear, nextMonthIndex, day);
};

export const distributeInstallmentAmounts = (
  totalAmountInCents: number,
  installmentCount: number,
) => {
  if (installmentCount <= 0 || !Number.isInteger(installmentCount)) {
    throw new Error(
      'A quantidade de parcelas precisa ser um inteiro positivo.',
    );
  }

  if (
    totalAmountInCents <= 0 ||
    !Number.isInteger(totalAmountInCents) ||
    !Number.isFinite(totalAmountInCents)
  ) {
    throw new Error('O valor total do parcelamento precisa ser valido.');
  }

  const baseAmountInCents = Math.floor(totalAmountInCents / installmentCount);
  const remainderInCents = totalAmountInCents % installmentCount;

  return Array.from(
    { length: installmentCount },
    (_unused, index) => baseAmountInCents + (index < remainderInCents ? 1 : 0),
  );
};

export const buildInstallmentOccurrenceListItems = (
  plans: InstallmentPlanListItem[],
  operations: InstallmentOperation[],
): InstallmentOccurrenceListItem[] => {
  const operationsByPlanId = operations.reduce<
    Record<string, InstallmentOperation[]>
  >((groupedOperations, operation) => {
    const currentOperations = groupedOperations[operation.planId] ?? [];

    currentOperations.push(operation);
    groupedOperations[operation.planId] = currentOperations;

    return groupedOperations;
  }, {});

  return plans
    .flatMap((plan) => {
      const amounts = distributeInstallmentAmounts(
        plan.totalAmountInCents,
        plan.installmentCount,
      );
      const planOperations = (operationsByPlanId[plan.id] ?? [])
        .slice()
        .sort(
          (left, right) =>
            left.operationDate.localeCompare(right.operationDate) ||
            left.createdAt.localeCompare(right.createdAt) ||
            left.id.localeCompare(right.id),
        );

      const occurrences: InstallmentOccurrenceListItem[] = amounts.map(
        (amountInCents, index) => {
        const installmentNumber = index + 1;
        const originalOccurrenceDate = shiftMonth(
          plan.firstOccurrenceDate,
          index,
        );

        return {
          id: `${plan.id}:${installmentNumber}`,
          planId: plan.id,
          sourceType: plan.sourceType,
          accountId: plan.accountId,
          creditCardId: plan.creditCardId,
          accountName: plan.accountName,
          creditCardName: plan.creditCardName,
          paymentAccountId: plan.paymentAccountId,
          paymentAccountName: plan.paymentAccountName,
          description: plan.description,
          installmentNumber,
          totalInstallments: plan.installmentCount,
          amountInCents,
          originalOccurrenceDate,
          occurrenceDate: originalOccurrenceDate,
          anticipatedOperationId: null,
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt,
        } satisfies InstallmentOccurrenceListItem;
        },
      );

      for (const operation of planOperations) {
        if (operation.type !== 'anticipation') {
          continue;
        }

        const targetOccurrences = occurrences
          .filter((occurrence) => occurrence.occurrenceDate > operation.operationDate)
          .sort(
            (left, right) =>
              left.occurrenceDate.localeCompare(right.occurrenceDate) ||
              left.installmentNumber - right.installmentNumber ||
              left.id.localeCompare(right.id),
          )
          .slice(0, operation.affectedInstallmentCount);

        for (const occurrence of targetOccurrences) {
          occurrence.occurrenceDate = operation.operationDate;
          occurrence.anticipatedOperationId = operation.id;
          occurrence.updatedAt = operation.createdAt;
        }
      }

      return occurrences;
    })
    .sort(
      (left, right) =>
        left.occurrenceDate.localeCompare(right.occurrenceDate) ||
        left.description.localeCompare(right.description) ||
        left.planId.localeCompare(right.planId) ||
        left.installmentNumber - right.installmentNumber,
    );
};

export const buildProjectedInstallmentOccurrences = (
  occurrences: InstallmentOccurrenceListItem[],
  currentDate?: string,
): ProjectedInstallmentOccurrence[] => {
  const currentMonthStart = getCurrentMonthStart(currentDate);

  return occurrences
    .filter(
      (occurrence) =>
        occurrence.sourceType === 'account' &&
        occurrence.accountId !== null &&
        occurrence.accountName !== null &&
        occurrence.occurrenceDate >= currentMonthStart,
    )
    .map(
      (occurrence) =>
        ({
          id: occurrence.id,
          planId: occurrence.planId,
          description: occurrence.description,
          accountId: occurrence.accountId as string,
          accountName: occurrence.accountName as string,
          amountInCents: occurrence.amountInCents,
          signedAmountInCents: -occurrence.amountInCents,
          occurrenceDate: occurrence.occurrenceDate,
          installmentNumber: occurrence.installmentNumber,
          totalInstallments: occurrence.totalInstallments,
        }) satisfies ProjectedInstallmentOccurrence,
    )
    .sort(
      (left, right) =>
        left.occurrenceDate.localeCompare(right.occurrenceDate) ||
        left.description.localeCompare(right.description) ||
        left.id.localeCompare(right.id),
    );
};

export const buildProjectedInstallmentCreditCardPurchases = (
  occurrences: InstallmentOccurrenceListItem[],
  currentDate?: string,
): ProjectedInstallmentCreditCardPurchase[] => {
  const currentMonthStart = getCurrentMonthStart(currentDate);

  return occurrences
    .filter(
      (occurrence) =>
        occurrence.sourceType === 'creditCard' &&
        occurrence.creditCardId !== null &&
        occurrence.creditCardName !== null &&
        occurrence.paymentAccountId !== null &&
        occurrence.paymentAccountName !== null &&
        occurrence.occurrenceDate >= currentMonthStart,
    )
    .map(
      (occurrence) =>
        ({
          id: occurrence.id,
          planId: occurrence.planId,
          creditCardId: occurrence.creditCardId as string,
          creditCardName: occurrence.creditCardName as string,
          paymentAccountId: occurrence.paymentAccountId as string,
          paymentAccountName: occurrence.paymentAccountName as string,
          description: occurrence.description,
          amountInCents: occurrence.amountInCents,
          purchaseDate: occurrence.occurrenceDate,
          installmentNumber: occurrence.installmentNumber,
          totalInstallments: occurrence.totalInstallments,
          createdAt: occurrence.createdAt,
          updatedAt: occurrence.updatedAt,
        }) satisfies ProjectedInstallmentCreditCardPurchase,
    )
    .sort(
      (left, right) =>
        left.purchaseDate.localeCompare(right.purchaseDate) ||
        left.description.localeCompare(right.description) ||
        left.id.localeCompare(right.id),
    );
};


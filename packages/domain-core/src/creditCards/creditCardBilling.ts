import type {
  CreditCardInvoice,
  CreditCard,
  CreditCardInvoicePreview,
  CreditCardListItem,
  CreditCardPurchase,
  CreditCardPurchaseListItem,
  ProjectedCreditCardInvoiceOccurrence,
  CreditCardStatementCycle,
} from '@shf/contracts';

type CreditCardBillingCard = Pick<
  CreditCardListItem,
  | 'id'
  | 'name'
  | 'statementClosingDay'
  | 'dueDay'
  | 'paymentAccountId'
  | 'paymentAccountName'
>;

const getDaysInMonth = (year: number, monthIndex: number) =>
  new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

const toDateString = (year: number, monthIndex: number, day: number) => {
  const boundedDay = Math.min(day, getDaysInMonth(year, monthIndex));

  return `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-${String(
    boundedDay,
  ).padStart(2, '0')}`;
};

const getCurrentMonthReference = (currentDate?: string) => {
  const reference = currentDate
    ? new Date(`${currentDate}T00:00:00.000Z`)
    : new Date();

  if (Number.isNaN(reference.valueOf())) {
    throw new Error('A data de referencia do cartao e invalida.');
  }

  return {
    year: reference.getUTCFullYear(),
    monthIndex: reference.getUTCMonth(),
    date: reference.toISOString().slice(0, 10),
  };
};

const shiftMonth = (year: number, monthIndex: number, delta: number) => {
  const absoluteMonthIndex = monthIndex + delta;

  return {
    year: year + Math.floor(absoluteMonthIndex / 12),
    monthIndex: ((absoluteMonthIndex % 12) + 12) % 12,
  };
};

const addDays = (date: string, days: number) => {
  const reference = new Date(`${date}T00:00:00.000Z`);
  reference.setUTCDate(reference.getUTCDate() + days);

  return reference.toISOString().slice(0, 10);
};

export const buildCurrentCreditCardCycle = (
  card: Pick<CreditCard, 'statementClosingDay' | 'dueDay'>,
  currentDate?: string,
): CreditCardStatementCycle => {
  const { year, monthIndex, date } = getCurrentMonthReference(currentDate);
  const currentMonthClosingDate = toDateString(
    year,
    monthIndex,
    card.statementClosingDay,
  );
  const cycleEndMonth =
    date <= currentMonthClosingDate
      ? { year, monthIndex }
      : shiftMonth(year, monthIndex, 1);
  const cycleEndDate = toDateString(
    cycleEndMonth.year,
    cycleEndMonth.monthIndex,
    card.statementClosingDay,
  );
  const previousCycleMonth = shiftMonth(
    cycleEndMonth.year,
    cycleEndMonth.monthIndex,
    -1,
  );
  const previousCycleEndDate = toDateString(
    previousCycleMonth.year,
    previousCycleMonth.monthIndex,
    card.statementClosingDay,
  );
  const dueMonth =
    card.dueDay > card.statementClosingDay
      ? cycleEndMonth
      : shiftMonth(cycleEndMonth.year, cycleEndMonth.monthIndex, 1);

  return {
    invoiceMonth: `${String(dueMonth.year).padStart(4, '0')}-${String(
      dueMonth.monthIndex + 1,
    ).padStart(2, '0')}`,
    cycleStartDate: addDays(previousCycleEndDate, 1),
    cycleEndDate,
    dueDate: toDateString(dueMonth.year, dueMonth.monthIndex, card.dueDay),
  };
};

export const buildCurrentCreditCardInvoicePreview = (
  card: Pick<CreditCard, 'id' | 'name' | 'statementClosingDay' | 'dueDay'>,
  currentDate?: string,
): CreditCardInvoicePreview => {
  const cycle = buildCurrentCreditCardCycle(card, currentDate);

  return {
    id: `${card.id}:${cycle.invoiceMonth}`,
    creditCardId: card.id,
    creditCardName: card.name,
    invoiceMonth: cycle.invoiceMonth,
    cycleStartDate: cycle.cycleStartDate,
    cycleEndDate: cycle.cycleEndDate,
    dueDate: cycle.dueDate,
    totalAmountInCents: 0,
  };
};

const getCurrentMonthStart = (currentDate?: string) => {
  const { year, monthIndex } = getCurrentMonthReference(currentDate);

  return toDateString(year, monthIndex, 1);
};

export const buildCreditCardPurchaseListItems = (
  cards: CreditCardBillingCard[],
  purchases: CreditCardPurchase[],
): CreditCardPurchaseListItem[] => {
  const cardsById = new Map(cards.map((card) => [card.id, card]));

  return purchases
    .map((purchase) => {
      const card = cardsById.get(purchase.creditCardId);

      if (!card) {
        throw new Error('Compra de cartao vinculada a um cartao inexistente.');
      }

      const invoicePreview = buildCurrentCreditCardInvoicePreview(
        {
          id: card.id,
          name: card.name,
          statementClosingDay: card.statementClosingDay,
          dueDay: card.dueDay,
        },
        purchase.purchaseDate,
      );

      return {
        ...purchase,
        creditCardName: card.name,
        paymentAccountId: card.paymentAccountId,
        paymentAccountName: card.paymentAccountName,
        invoiceMonth: invoicePreview.invoiceMonth,
        cycleStartDate: invoicePreview.cycleStartDate,
        cycleEndDate: invoicePreview.cycleEndDate,
        dueDate: invoicePreview.dueDate,
      } satisfies CreditCardPurchaseListItem;
    })
    .sort(
      (left, right) =>
        right.purchaseDate.localeCompare(left.purchaseDate) ||
        right.createdAt.localeCompare(left.createdAt) ||
        right.id.localeCompare(left.id),
    );
};

export const buildCreditCardInvoices = (
  purchases: CreditCardPurchaseListItem[],
  currentDate?: string,
): CreditCardInvoice[] => {
  const referenceDate = getCurrentMonthReference(currentDate).date;
  const invoicesById = new Map<string, CreditCardInvoice>();

  for (const purchase of purchases) {
    const invoiceId = `${purchase.creditCardId}:${purchase.invoiceMonth}`;
    const existingInvoice = invoicesById.get(invoiceId);

    if (existingInvoice) {
      existingInvoice.totalAmountInCents += purchase.amountInCents;
      existingInvoice.purchaseCount += 1;
      existingInvoice.purchases.push(purchase);
      continue;
    }

    const status =
      referenceDate <= purchase.cycleEndDate
        ? 'open'
        : referenceDate <= purchase.dueDate
          ? 'upcoming'
          : 'overdue';

    invoicesById.set(invoiceId, {
      id: invoiceId,
      creditCardId: purchase.creditCardId,
      creditCardName: purchase.creditCardName,
      paymentAccountId: purchase.paymentAccountId,
      paymentAccountName: purchase.paymentAccountName,
      invoiceMonth: purchase.invoiceMonth,
      cycleStartDate: purchase.cycleStartDate,
      cycleEndDate: purchase.cycleEndDate,
      dueDate: purchase.dueDate,
      totalAmountInCents: purchase.amountInCents,
      purchaseCount: 1,
      status,
      purchases: [purchase],
    });
  }

  return [...invoicesById.values()]
    .map((invoice) => ({
      ...invoice,
      purchases: invoice.purchases
        .slice()
        .sort(
          (left, right) =>
            right.purchaseDate.localeCompare(left.purchaseDate) ||
            right.createdAt.localeCompare(left.createdAt) ||
            right.id.localeCompare(left.id),
        ),
    }))
    .sort(
      (left, right) =>
        left.dueDate.localeCompare(right.dueDate) ||
        left.creditCardName.localeCompare(right.creditCardName) ||
        left.id.localeCompare(right.id),
    );
};

export const buildProjectedCreditCardInvoiceOccurrences = (
  invoices: CreditCardInvoice[],
  currentDate?: string,
): ProjectedCreditCardInvoiceOccurrence[] => {
  const currentMonthStart = getCurrentMonthStart(currentDate);

  return invoices
    .filter((invoice) => invoice.dueDate >= currentMonthStart)
    .map(
      (invoice) =>
        ({
          id: invoice.id,
          creditCardId: invoice.creditCardId,
          creditCardName: invoice.creditCardName,
          paymentAccountId: invoice.paymentAccountId,
          paymentAccountName: invoice.paymentAccountName,
          invoiceMonth: invoice.invoiceMonth,
          amountInCents: invoice.totalAmountInCents,
          signedAmountInCents: -invoice.totalAmountInCents,
          occurrenceDate: invoice.dueDate,
        }) satisfies ProjectedCreditCardInvoiceOccurrence,
    )
    .sort(
      (left, right) =>
        left.occurrenceDate.localeCompare(right.occurrenceDate) ||
        left.creditCardName.localeCompare(right.creditCardName) ||
        left.id.localeCompare(right.id),
    );
};


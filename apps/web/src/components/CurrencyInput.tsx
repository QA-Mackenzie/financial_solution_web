import { useEffect, useState } from 'react';
import {
  type Control,
  type FieldPath,
  type FieldValues,
  useController,
} from 'react-hook-form';

import {
  formatCurrencyInCents,
  parseCurrencyInputToCents,
} from '../lib/finance-format';

type CurrencyInputProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  placeholder?: string;
};

function normalizeCurrencyValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function CurrencyInput<TFieldValues extends FieldValues>({
  control,
  name,
  placeholder = 'R$ 0,00',
}: CurrencyInputProps<TFieldValues>) {
  const { field } = useController({
    control,
    name,
  });
  const [isFocused, setIsFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState(() =>
    formatCurrencyInCents(normalizeCurrencyValue(field.value)),
  );

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatCurrencyInCents(normalizeCurrencyValue(field.value)));
    }
  }, [field.value, isFocused]);

  return (
    <input
      inputMode="decimal"
      name={field.name}
      onBlur={() => {
        const amountInCents = parseCurrencyInputToCents(displayValue);

        field.onChange(amountInCents);
        field.onBlur();
        setIsFocused(false);
        setDisplayValue(formatCurrencyInCents(amountInCents));
      }}
      onChange={(event) => {
        const nextDisplayValue = event.target.value;

        setDisplayValue(nextDisplayValue);
        field.onChange(parseCurrencyInputToCents(nextDisplayValue));
      }}
      onFocus={(event) => {
        setIsFocused(true);
        event.currentTarget.select();
      }}
      placeholder={placeholder}
      ref={field.ref}
      type="text"
      value={displayValue}
    />
  );
}

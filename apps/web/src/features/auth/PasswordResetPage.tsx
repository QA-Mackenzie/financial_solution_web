import { zodResolver } from '@hookform/resolvers/zod';
import { passwordResetInputSchema, type PasswordResetInput } from '@economy-cash/contracts';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { usePasswordResetMutation } from './use-session';

export function PasswordResetPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetMutation = usePasswordResetMutation();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<PasswordResetInput>({
    resolver: zodResolver(passwordResetInputSchema),
    defaultValues: {
      password: '',
      token: searchParams.get('token') ?? '',
    },
  });

  useEffect(() => {
    setValue('token', searchParams.get('token') ?? '');
  }, [searchParams, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    await resetMutation.mutateAsync(values);
    navigate('/login', { replace: true });
  });

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="eyebrow">Reset seguro</div>
        <h1>Defina uma nova senha</h1>

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            <span>Token</span>
            <input {...register('token')} placeholder="Cole o token de redefinição" />
            <small>{errors.token?.message}</small>
          </label>

          <label>
            <span>Nova senha</span>
            <input
              {...register('password')}
              placeholder="Mínimo de 8 caracteres"
              type="password"
            />
            <small>{errors.password?.message}</small>
          </label>

          {resetMutation.error ? (
            <div className="feedback feedback-error">
              {resetMutation.error.message}
            </div>
          ) : null}

          <button disabled={resetMutation.isPending} type="submit">
            {resetMutation.isPending ? 'Atualizando...' : 'Atualizar senha'}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/login">Voltar para o login</Link>
        </div>
      </section>
    </main>
  );
}

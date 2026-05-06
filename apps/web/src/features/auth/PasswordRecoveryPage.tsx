import { zodResolver } from '@hookform/resolvers/zod';
import {
  passwordResetRequestInputSchema,
  type PasswordResetRequestInput,
} from '@shf/contracts';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { usePasswordRecoveryMutation } from './use-session';

export function PasswordRecoveryPage() {
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const recoveryMutation = usePasswordRecoveryMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordResetRequestInput>({
    resolver: zodResolver(passwordResetRequestInputSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const result = await recoveryMutation.mutateAsync(values);
    setPreviewToken(result.previewToken ?? null);
  });

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="eyebrow">Recuperacao</div>
        <h1>Recupere seu acesso</h1>
        <p>
          Informe o email da sua conta para gerar um link seguro de redefinicao.
        </p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            <span>Email</span>
            <input {...register('email')} placeholder="voce@exemplo.com" />
            <small>{errors.email?.message}</small>
          </label>

          {recoveryMutation.error ? (
            <div className="feedback feedback-error">
              {recoveryMutation.error.message}
            </div>
          ) : null}

          {recoveryMutation.isSuccess ? (
            <div className="feedback">
              Se o email existir, um link de redefinicao foi disponibilizado.
            </div>
          ) : null}

          {previewToken ? (
            <div className="feedback">
              Ambiente local: use este{' '}
              <Link to={`/redefinir-senha?token=${previewToken}`}>
                link de redefinicao
              </Link>
              .
            </div>
          ) : null}

          <button disabled={recoveryMutation.isPending} type="submit">
            {recoveryMutation.isPending ? 'Gerando link...' : 'Gerar link'}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/login">Voltar para o login</Link>
        </div>
      </section>
    </main>
  );
}
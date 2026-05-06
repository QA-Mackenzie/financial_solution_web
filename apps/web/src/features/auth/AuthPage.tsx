import { zodResolver } from '@hookform/resolvers/zod';
import {
  loginInputSchema,
  registerInputSchema,
  type LoginInput,
  type RegisterInput,
} from '@shf/contracts';
import { useForm, type FieldErrors } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

import { useLoginMutation, useRegisterMutation } from './use-session';

type AuthPageProps = {
  mode: 'login' | 'register';
};

const consentVersion = import.meta.env.VITE_CONSENT_VERSION ?? '2026-05';

export function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate();
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();
  const isRegisterMode = mode === 'register';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput | RegisterInput>({
    resolver: zodResolver(
      isRegisterMode ? registerInputSchema : loginInputSchema,
    ),
    defaultValues: isRegisterMode
      ? {
          consentAccepted: false,
          consentVersion,
          name: '',
          email: '',
          password: '',
        }
      : {
          email: '',
          password: '',
        },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (isRegisterMode) {
      await registerMutation.mutateAsync(values as RegisterInput);
    } else {
      await loginMutation.mutateAsync(values as LoginInput);
    }

    navigate('/app');
  });

  const currentMutation = isRegisterMode ? registerMutation : loginMutation;
  const nameError = isRegisterMode
    ? (errors as FieldErrors<RegisterInput>).name?.message
    : undefined;
  const consentError = isRegisterMode
    ? (errors as FieldErrors<RegisterInput>).consentAccepted?.message
    : undefined;

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="eyebrow">Sprint 1</div>
        <h1>{isRegisterMode ? 'Crie sua conta' : 'Entre na plataforma'}</h1>
        <p>
          Acesse a shell autenticada da SHF Web com sessao segura, auditoria e
          recuperacao de senha.
        </p>

        <form className="auth-form" onSubmit={onSubmit}>
          {isRegisterMode ? (
            <label>
              <span>Nome</span>
              <input {...register('name')} placeholder="Seu nome" />
              <small>{nameError}</small>
            </label>
          ) : null}

          <label>
            <span>Email</span>
            <input {...register('email')} placeholder="voce@exemplo.com" />
            <small>{errors.email?.message}</small>
          </label>

          <label>
            <span>Senha</span>
            <input
              {...register('password')}
              placeholder="Minimo de 8 caracteres"
              type="password"
            />
            <small>{errors.password?.message}</small>
          </label>

          {isRegisterMode ? (
            <>
              <input type="hidden" {...register('consentVersion')} />

              <label className="checkbox-field">
                <input type="checkbox" {...register('consentAccepted')} />
                <span>
                  Li e aceito a politica de privacidade e os termos da versao{' '}
                  {consentVersion}.
                </span>
              </label>
              <small>{consentError}</small>
            </>
          ) : null}

          {currentMutation.error ? (
            <div className="feedback feedback-error">
              {currentMutation.error.message}
            </div>
          ) : null}

          <button disabled={currentMutation.isPending} type="submit">
            {currentMutation.isPending
              ? 'Processando...'
              : isRegisterMode
                ? 'Criar conta'
                : 'Entrar'}
          </button>
        </form>

        <div className="auth-footer">
          {isRegisterMode ? 'Ja possui uma conta?' : 'Ainda nao tem uma conta?'}{' '}
          <Link to={isRegisterMode ? '/login' : '/cadastro'}>
            {isRegisterMode ? 'Fazer login' : 'Criar conta'}
          </Link>
        </div>

        {!isRegisterMode ? (
          <div className="auth-link-row">
            <Link to="/esqueci-senha">Esqueci minha senha</Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}

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

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="eyebrow">Sprint 0</div>
        <h1>{isRegisterMode ? 'Crie sua conta' : 'Entre na plataforma'}</h1>
        <p>
          Base inicial da SHF Web com frontend React, API Fastify e sessao em
          cookie.
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
      </section>
    </main>
  );
}

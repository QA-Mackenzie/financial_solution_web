import { zodResolver } from '@hookform/resolvers/zod';
import {
  createPrivacyRequestInputSchema,
  type CreatePrivacyRequestInput,
} from '@economy-cash/contracts';
import { useForm } from 'react-hook-form';

import {
  useCreatePrivacyRequestMutation,
  usePrivacyRequestsQuery,
} from '../auth/use-privacy';
import { useSessionQuery } from '../auth/use-session';

const privacyRequestTypeLabels = {
  anonymization: 'Anonimizacao de dados identificaveis',
  erasure: 'Exclusao e encerramento do cadastro',
};

const privacyRequestStatusLabels = {
  completed: 'Concluida',
  pending: 'Pendente',
  processing: 'Em analise',
  rejected: 'Recusada',
};

export function AccessPage() {
  const { data: session } = useSessionQuery();
  const privacyRequestsQuery = usePrivacyRequestsQuery();
  const createPrivacyRequestMutation = useCreatePrivacyRequestMutation();
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<CreatePrivacyRequestInput>({
    resolver: zodResolver(createPrivacyRequestInputSchema),
    defaultValues: {
      justification: '',
      requestType: 'anonymization',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await createPrivacyRequestMutation.mutateAsync(values);
    reset({
      justification: '',
      requestType: values.requestType,
    });
  });

  return (
    <section className="dashboard-grid">
      <article className="dashboard-card hero-card">
        <div className="eyebrow">Conta autenticada</div>
        <h2>Segurança da conta</h2>
      </article>

      <article className="dashboard-card">
        <h3>Resumo da sessão</h3>
        <div className="detail-list">
          <div className="detail-item">
            <strong>Usuário</strong>
            <span>{session?.user.name ?? '--'}</span>
          </div>
          <div className="detail-item">
            <strong>Email</strong>
            <span>{session?.user.email ?? '--'}</span>
          </div>
        </div>
      </article>

      <article className="dashboard-card">
        <h3>Direitos LGPD</h3>
        <p>
          Abra uma solicitacao formal para anonimizar dados identificaveis ou
          iniciar o fluxo assistido de exclusao do cadastro.
        </p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            <span>Tipo de solicitacao</span>
            <select {...register('requestType')}>
              <option value="anonymization">
                {privacyRequestTypeLabels.anonymization}
              </option>
              <option value="erasure">{privacyRequestTypeLabels.erasure}</option>
            </select>
            <small>{errors.requestType?.message}</small>
          </label>

          <label>
            <span>Contexto</span>
            <textarea
              {...register('justification')}
              placeholder="Descreva o motivo e qualquer orientacao adicional para o atendimento."
              rows={4}
            />
            <small>{errors.justification?.message}</small>
          </label>

          {createPrivacyRequestMutation.error ? (
            <div className="feedback feedback-error">
              {createPrivacyRequestMutation.error.message}
            </div>
          ) : null}

          {createPrivacyRequestMutation.isSuccess ? (
            <div className="feedback">
              Solicitacao registrada. O time operacional seguira a trilha LGPD e
              retornara pelo atendimento previsto.
            </div>
          ) : null}

          <button disabled={createPrivacyRequestMutation.isPending} type="submit">
            {createPrivacyRequestMutation.isPending
              ? 'Registrando...'
              : 'Registrar solicitacao'}
          </button>
        </form>
      </article>

      <article className="dashboard-card">
        <h3>Historico de solicitacoes</h3>

        {privacyRequestsQuery.isLoading ? (
          <div className="screen-message">Carregando historico...</div>
        ) : null}

        {privacyRequestsQuery.error ? (
          <div className="feedback feedback-error">
            {privacyRequestsQuery.error.message}
          </div>
        ) : null}

        {!privacyRequestsQuery.isLoading &&
        !privacyRequestsQuery.error &&
        (privacyRequestsQuery.data?.requests.length ?? 0) === 0 ? (
          <p>Nenhuma solicitacao LGPD foi registrada ate agora.</p>
        ) : null}

        {(privacyRequestsQuery.data?.requests.length ?? 0) > 0 ? (
          <div className="detail-list">
            {privacyRequestsQuery.data?.requests.map((privacyRequest) => (
              <div className="detail-item" key={privacyRequest.id}>
                <strong>
                  {privacyRequestTypeLabels[privacyRequest.requestType]}
                </strong>
                <span>
                  {privacyRequestStatusLabels[privacyRequest.status]} •{' '}
                  {new Date(privacyRequest.requestedAt).toLocaleDateString('pt-BR')}
                </span>
                <span>{privacyRequest.justification}</span>
              </div>
            ))}
          </div>
        ) : null}
      </article>
    </section>
  );
}

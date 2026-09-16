/**
 * Fachada com a mesma forma da API tRPC que a aplicação usava.
 *
 * As páginas continuam a escrever
 *
 *     trpc.evaluations.list.useQuery({ neop })
 *     trpc.operations.update.useMutation({ onSuccess })
 *     const utils = trpc.useUtils()
 *
 * mas por baixo já não há servidor nenhum: cada chamada vai diretamente ao
 * Supabase através de client/src/lib/api.ts, com o TanStack Query a tratar de
 * cache e invalidação — exatamente como antes.
 *
 * Isto existe para que a migração não obrigasse a reescrever 21 páginas. Se um
 * dia fizer sentido limpar, cada `trpc.x.y.useQuery(input)` troca-se por um
 * `useQuery({ queryKey, queryFn: () => api.x.y(input) })` sem mais nada mudar.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { api } from "./api";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type AnyFn = (...args: any[]) => Promise<any>;

type Input<F> = F extends (input: infer I) => Promise<any> ? I : void;
type Output<F> = F extends (...args: any[]) => Promise<infer O> ? O : never;

interface Endpoint<F extends AnyFn> {
  useQuery(
    input?: Input<F>,
    options?: Omit<UseQueryOptions<Output<F>, Error>, "queryKey" | "queryFn">,
  ): UseQueryResult<Output<F>, Error>;

  useMutation(
    options?: Omit<UseMutationOptions<Output<F>, Error, Input<F>>, "mutationFn">,
  ): UseMutationResult<Output<F>, Error, Input<F>>;
}

type Router<T> = {
  [K in keyof T]: T[K] extends AnyFn ? Endpoint<T[K]> : Router<T[K]>;
};

interface Utils<F extends AnyFn> {
  invalidate(input?: Input<F>): Promise<void>;
  setData(input: Input<F> | undefined, data: Output<F> | null): void;
  getData(input?: Input<F>): Output<F> | undefined;
  refetch(input?: Input<F>): Promise<void>;
}

type UtilsRouter<T> = {
  [K in keyof T]: T[K] extends AnyFn ? Utils<T[K]> : UtilsRouter<T[K]>;
} & { invalidate(): Promise<void> };

// ─── Construção ──────────────────────────────────────────────────────────────

/** A chave de cache é o caminho do procedimento mais o input, tal como no tRPC. */
const queryKeyFor = (path: string[], input: unknown) =>
  input === undefined ? [...path] : [...path, input];

function buildRouter(node: Record<string, any>, path: string[]): any {
  const out: Record<string, any> = {};

  for (const [key, value] of Object.entries(node)) {
    const currentPath = [...path, key];

    if (typeof value === "function") {
      out[key] = {
        useQuery(input?: unknown, options?: Record<string, unknown>) {
          return useQuery({
            queryKey: queryKeyFor(currentPath, input),
            queryFn: () => value(input),
            ...options,
          });
        },
        useMutation(options?: Record<string, unknown>) {
          return useMutation({
            mutationFn: (input: unknown) => value(input),
            ...options,
          });
        },
      };
    } else {
      out[key] = buildRouter(value, currentPath);
    }
  }

  return out;
}

function buildUtils(node: Record<string, any>, path: string[], queryClient: any): any {
  const out: Record<string, any> = {
    invalidate: () => queryClient.invalidateQueries({ queryKey: path }),
  };

  for (const [key, value] of Object.entries(node)) {
    const currentPath = [...path, key];

    if (typeof value === "function") {
      out[key] = {
        // Sem input, invalida todas as variantes deste procedimento.
        invalidate: (input?: unknown) =>
          queryClient.invalidateQueries({ queryKey: queryKeyFor(currentPath, input) }),
        setData: (input: unknown, data: unknown) =>
          queryClient.setQueryData(queryKeyFor(currentPath, input), data),
        getData: (input?: unknown) => queryClient.getQueryData(queryKeyFor(currentPath, input)),
        refetch: (input?: unknown) =>
          queryClient.refetchQueries({ queryKey: queryKeyFor(currentPath, input) }),
      };
    } else {
      out[key] = buildUtils(value, currentPath, queryClient);
    }
  }

  return out;
}

const routers = buildRouter(api, []) as Router<typeof api>;

export const trpc = {
  ...routers,

  useUtils(): UtilsRouter<typeof api> {
    const queryClient = useQueryClient();
    return buildUtils(api, [], queryClient);
  },
};

export { api };

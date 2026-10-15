import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

/**
 * Proteção contra clickjacking. O GitHub Pages não permite enviar cabeçalhos
 * HTTP (X-Frame-Options, ou frame-ancestors na CSP — que não funciona por
 * <meta>), por isso a aplicação recusa-se a correr dentro de uma moldura de
 * outra página, onde alguém poderia levar o militar a clicar em ações sem se
 * aperceber.
 */
function dentroDeMoldura() {
  try {
    return window.self !== window.top;
  } catch {
    // Acesso a window.top bloqueado: está numa moldura de outra origem.
    return true;
  }
}

const raiz = document.getElementById("root")!;

if (dentroDeMoldura()) {
  raiz.textContent =
    "Por segurança, esta aplicação não pode ser apresentada dentro de outra página. Abra-a diretamente no browser.";
} else {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  // Registar erros na consola apenas em desenvolvimento: em produção as
  // mensagens já chegam ao utilizador pelos avisos, e a consola fica limpa de
  // detalhes internos.
  if (import.meta.env.DEV) {
    queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") {
        console.error("[Query]", event.query.state.error);
      }
    });

    queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") {
        console.error("[Mutation]", event.mutation.state.error);
      }
    });
  }

  createRoot(raiz).render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

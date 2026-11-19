import { IonApp, IonRouterOutlet, setupIonicReact } from "@ionic/react";
import { IonReactMemoryRouter, IonReactRouter } from "@ionic/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { Navigate, Route } from "react-router-dom";
import { PersonalMaintenancePage } from "@/features/personal/PersonalMaintenancePage";
import { ReferenceMaintenancePage } from "@/features/reference/ReferenceMaintenancePage";
import {
  cargoConfig,
  dependenciaConfig,
  paisConfig,
} from "@/features/reference/reference-config";
import { HomePage } from "@/features/shell/HomePage";
import { IonicFeedbackProvider } from "@/lib/feedback";
import { VariantAHomePage } from "@/variants/a/VariantAHomePage";
import { VariantAPaisPage } from "@/variants/a/VariantAPaisPage";
import { VariantBHomePage } from "@/variants/b/VariantBHomePage";
import { VariantBPaisPage } from "@/variants/b/VariantBPaisPage";
import { VariantCHomePage } from "@/variants/c/VariantCHomePage";
import { VariantCPaisPage } from "@/variants/c/VariantCPaisPage";
import { type AppVariant, resolveAppVariant } from "@/variants/variant-config";

setupIonicReact();

const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function OriginalAppRoutes() {
  return (
    <IonRouterOutlet>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/pais"
        element={<ReferenceMaintenancePage config={paisConfig} />}
      />
      <Route
        path="/dependencia"
        element={<ReferenceMaintenancePage config={dependenciaConfig} />}
      />
      <Route
        path="/cargo"
        element={<ReferenceMaintenancePage config={cargoConfig} />}
      />
      <Route path="/personal" element={<PersonalMaintenancePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </IonRouterOutlet>
  );
}

function VariantARoutes() {
  return (
    <IonRouterOutlet>
      <Route path="/" element={<VariantAHomePage />} />
      <Route path="/pais" element={<VariantAPaisPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </IonRouterOutlet>
  );
}

function VariantBRoutes() {
  return (
    <IonRouterOutlet>
      <Route path="/" element={<VariantBHomePage />} />
      <Route path="/pais" element={<VariantBPaisPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </IonRouterOutlet>
  );
}

function VariantCRoutes() {
  return (
    <IonRouterOutlet>
      <Route path="/" element={<VariantCHomePage />} />
      <Route path="/pais" element={<VariantCPaisPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </IonRouterOutlet>
  );
}

function renderVariantRoutes(variant: AppVariant): React.ReactElement {
  switch (variant) {
    case "original":
      return <OriginalAppRoutes />;
    case "A":
      return <VariantARoutes />;
    case "B":
      return <VariantBRoutes />;
    case "C":
      return <VariantCRoutes />;
  }
}

export interface AppProps {
  readonly initialEntries?: string[];
  readonly client?: QueryClient;
  readonly variant?: AppVariant;
}

export const App: React.FC<AppProps> = ({
  initialEntries,
  client,
  variant,
}) => {
  const activeClient = client ?? appQueryClient;
  const activeVariant =
    variant ?? resolveAppVariant(import.meta.env.VITE_APP_VARIANT);

  React.useEffect(() => {
    if (activeVariant === "original") {
      delete document.documentElement.dataset.variant;
      return;
    }
    document.documentElement.dataset.variant = activeVariant;
    return () => {
      delete document.documentElement.dataset.variant;
    };
  }, [activeVariant]);

  const routes = renderVariantRoutes(activeVariant);

  return (
    <QueryClientProvider client={activeClient}>
      <IonApp
        data-variant={activeVariant === "original" ? undefined : activeVariant}
      >
        <IonicFeedbackProvider>
          {initialEntries ? (
            <IonReactMemoryRouter initialEntries={initialEntries}>
              {routes}
            </IonReactMemoryRouter>
          ) : (
            <IonReactRouter>{routes}</IonReactRouter>
          )}
        </IonicFeedbackProvider>
      </IonApp>
    </QueryClientProvider>
  );
};

export default App;

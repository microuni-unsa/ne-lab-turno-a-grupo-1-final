import { IonApp, IonRouterOutlet, setupIonicReact } from "@ionic/react";
import { IonReactMemoryRouter, IonReactRouter } from "@ionic/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as React from "react";
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

setupIonicReact();

const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
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

export interface AppProps {
  readonly initialEntries?: string[];
  readonly client?: QueryClient;
}

export const App: React.FC<AppProps> = ({ initialEntries, client }) => {
  const activeClient = client ?? appQueryClient;

  return (
    <QueryClientProvider client={activeClient}>
      <IonApp>
        <IonicFeedbackProvider>
          {initialEntries ? (
            <IonReactMemoryRouter initialEntries={initialEntries}>
              <AppRoutes />
            </IonReactMemoryRouter>
          ) : (
            <IonReactRouter>
              <AppRoutes />
            </IonReactRouter>
          )}
        </IonicFeedbackProvider>
      </IonApp>
    </QueryClientProvider>
  );
};

export default App;

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ReminderProvider } from './contexts/ReminderContext';
import { RepositoryProvider } from './contexts/RepositoryContext';
import { SecurityProvider } from './contexts/SecurityContext';
import { AuthProvider } from './contexts/AuthContext';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <RepositoryProvider>
          <AuthProvider>
            <SecurityProvider>
              <NotificationProvider>
                <ReminderProvider>
                  <SidebarProvider>
                    <App />
                  </SidebarProvider>
                </ReminderProvider>
              </NotificationProvider>
            </SecurityProvider>
          </AuthProvider>
        </RepositoryProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

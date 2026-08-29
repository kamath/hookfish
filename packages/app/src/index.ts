import './styles.css'

export { App, AppErrorPage, AppNotFound, type AppProps } from './app'
export { AppProviders } from './providers'
export {
  createAppRouter,
  mountApp,
  type AppRouter,
  type AppRouterOptions,
} from './router'
export { HomePage } from './pages/home'
export { LoginPage } from './pages/login'
export {
  WorkbenchPage,
  validateWorkbenchSearch,
  type WorkbenchRouteProps,
} from './pages/workbench'
export { THEME_COLORS, THEME_INIT_SCRIPT } from './lib/theme'

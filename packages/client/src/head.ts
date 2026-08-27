export const THEME_KEY = 'oc:theme'

export const THEME_COLORS = {
  light: '#f7f6f3',
  dark: '#141311',
} as const

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t!=='light'&&t!=='dark')t='system';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='system'}})()`

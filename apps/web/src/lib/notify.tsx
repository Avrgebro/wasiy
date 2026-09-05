import { showNotification, type NotificationData } from '@mantine/notifications'
import { CheckCircle, DangerCircle, DangerTriangle, InfoCircle } from '@solar-icons/react'
import type { CSSProperties, ReactNode } from 'react'

type NotifyOptions = Omit<NotificationData, 'message' | 'title' | 'color' | 'icon'>

/**
 * The app's only door to toasts: every variant carries its Puerto role color
 * and Solar icon, styled by the .wa-toast classes in index.css. Feature code
 * never calls showNotification directly — variant look lives here, once.
 */
function notify(
  roleColor: string,
  icon: ReactNode,
  message: ReactNode,
  title?: ReactNode,
  options?: NotifyOptions,
) {
  showNotification({
    ...options,
    classNames: {
      root: 'wa-toast',
      icon: 'wa-toast__icon',
      title: 'wa-toast__title',
      description: 'wa-toast__description',
      closeButton: 'wa-toast__close',
    },
    icon,
    message,
    style: { '--wa-toast-color': roleColor } as CSSProperties,
    title,
  })
}

export function notifySuccess(message: ReactNode, title?: ReactNode, options?: NotifyOptions) {
  notify('var(--wa-success)', <CheckCircle size={19} weight="Bold" />, message, title, options)
}

export function notifyError(message: ReactNode, title?: ReactNode, options?: NotifyOptions) {
  notify('var(--wa-error)', <DangerCircle size={19} weight="Bold" />, message, title, options)
}

export function notifyWarning(message: ReactNode, title?: ReactNode, options?: NotifyOptions) {
  notify('var(--wa-warning)', <DangerTriangle size={19} weight="Bold" />, message, title, options)
}

export function notifyInfo(message: ReactNode, title?: ReactNode, options?: NotifyOptions) {
  notify('var(--wa-info)', <InfoCircle size={19} weight="Bold" />, message, title, options)
}

import { showNotification, type NotificationData } from '@mantine/notifications'
import { CheckCircleIcon, DangerCircleIcon, DangerTriangleIcon, InfoCircleIcon } from '@solar-icons/react/dynamic'
import type { CSSProperties, ReactNode } from 'react'

type NotifyOptions = Omit<NotificationData, 'message' | 'title' | 'color' | 'icon'>

/**
 * The app's only door to toasts: every variant carries its Puerto role color
 * and Solar icon, styled by the .wa-toast classes in index.css. Feature code
 * never calls showNotification directly — variant look lives here, once.
 * Every toast has a title (mockup 07): a call with only a message shows it
 * as the title; a call with both shows the message as the dimmed second line.
 */
function notify(
  roleColor: string,
  icon: ReactNode,
  message: ReactNode,
  title?: ReactNode,
  options?: NotifyOptions,
) {
  const headline = title ?? message
  const detail = title ? message : undefined

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
    message: detail,
    style: { '--wa-toast-color': roleColor } as CSSProperties,
    title: headline,
  })
}

export function notifySuccess(message: ReactNode, title?: ReactNode, options?: NotifyOptions) {
  notify('var(--wa-success)', <CheckCircleIcon size={19} weight="Bold" />, message, title, options)
}

export function notifyError(message: ReactNode, title?: ReactNode, options?: NotifyOptions) {
  notify('var(--wa-error)', <DangerCircleIcon size={19} weight="Bold" />, message, title, options)
}

export function notifyWarning(message: ReactNode, title?: ReactNode, options?: NotifyOptions) {
  notify('var(--wa-warning)', <DangerTriangleIcon size={19} weight="Bold" />, message, title, options)
}

export function notifyInfo(message: ReactNode, title?: ReactNode, options?: NotifyOptions) {
  notify('var(--wa-info)', <InfoCircleIcon size={19} weight="Bold" />, message, title, options)
}

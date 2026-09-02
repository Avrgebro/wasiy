import { Text } from '@mantine/core'
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone'
import { showNotification } from '@mantine/notifications'
import { AddCircle, Camera } from '@solar-icons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../../lib/errors'
import {
  deleteLocationPhoto,
  reorderLocationPhotos,
  setLocationCoverPhoto,
  uploadLocationPhoto,
  type LocationPhoto,
} from './api'

const MAX_PHOTOS = 10

/**
 * The Fotos card of the Información tab (mockup 03): tile grid with the
 * Portada badge, per-photo Hacer portada / Eliminar, native drag reorder,
 * and a dropzone tile. Read-only when the location is deactivated.
 */
export function LocationPhotoGallery({
  accountId,
  locationId,
  photos,
  readOnly,
}: {
  accountId: string
  locationId: string
  photos: LocationPhoto[]
  readOnly: boolean
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const dragIndex = useRef<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['locations'] })
  }

  const notifyError = (error: unknown) => {
    showNotification({ color: 'red', message: getErrorMessage(error) })
  }

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) =>
      Promise.all(files.map((file) => uploadLocationPhoto(accountId, locationId, file))),
    onSuccess: invalidate,
    onError: notifyError,
  })

  const deleteMutation = useMutation({
    mutationFn: (photoId: string) => deleteLocationPhoto(accountId, locationId, photoId),
    onSuccess: invalidate,
    onError: notifyError,
  })

  const coverMutation = useMutation({
    mutationFn: (photoId: string) => setLocationCoverPhoto(accountId, locationId, photoId),
    onSuccess: invalidate,
    onError: notifyError,
  })

  const reorderMutation = useMutation({
    mutationFn: (photoIds: string[]) => reorderLocationPhotos(accountId, locationId, photoIds),
    onSuccess: invalidate,
    onError: notifyError,
  })

  function handleDrop(targetIndex: number) {
    const from = dragIndex.current
    dragIndex.current = null
    setDropTarget(null)

    if (from === null || from === targetIndex) {
      return
    }

    const next = [...photos]
    const [moved] = next.splice(from, 1)
    next.splice(targetIndex, 0, moved)
    reorderMutation.mutate(next.map((photo) => photo.id))
  }

  return (
    <section
      className="overflow-hidden rounded-[14px] border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]"
      id="location-photos"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--mantine-color-default-border)] px-5 py-4">
        <div>
          <Text fw={600}>{t('locations.photos.title')}</Text>
          <Text c="dimmed" mt={2} size="xs">
            {t('locations.photos.hint')}
          </Text>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3.5 p-5 @xl:grid-cols-2 @4xl:grid-cols-4">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className={`relative h-[170px] overflow-hidden rounded-xl bg-[var(--wa-surface-2)] ${
              dropTarget === index ? 'outline outline-2 outline-[var(--wa-interactive)]' : ''
            }`}
            draggable={!readOnly}
            onDragEnd={() => {
              dragIndex.current = null
              setDropTarget(null)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setDropTarget(index)
            }}
            onDragStart={() => {
              dragIndex.current = index
            }}
            onDrop={() => handleDrop(index)}
          >
            <img alt={photo.original_filename} className="absolute inset-0 size-full object-cover" src={photo.url} />
            {photo.is_cover ? (
              <span className="absolute left-2.5 top-2.5 rounded-full bg-[var(--wa-accent)] px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#1c2b2c]">
                {t('locations.photos.cover')}
              </span>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-[var(--mantine-color-body)]/85 px-3 py-2">
              <Text className="min-w-0" size="xs" truncate>
                {photo.original_filename}
              </Text>
              {readOnly ? null : (
                <span className="flex shrink-0 gap-2.5 text-xs font-medium">
                  {photo.is_cover ? null : (
                    <button
                      className="cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-[var(--wa-interactive)]"
                      type="button"
                      onClick={() => coverMutation.mutate(photo.id)}
                    >
                      {t('locations.photos.makeCover')}
                    </button>
                  )}
                  <button
                    className="cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-[var(--wa-error)]"
                    type="button"
                    onClick={() => deleteMutation.mutate(photo.id)}
                  >
                    {t('locations.photos.delete')}
                  </button>
                </span>
              )}
            </div>
          </div>
        ))}
        {readOnly || photos.length >= MAX_PHOTOS ? null : (
          <Dropzone
            accept={IMAGE_MIME_TYPE.filter((type) => type === 'image/jpeg' || type === 'image/png')}
            aria-label={t('locations.photos.add')}
            // relative is load-bearing: the hidden file <input> inside is
            // position:absolute, and without a positioned ancestor it anchors
            // to the document and gives the page a second scrollbar.
            className="relative grid h-[170px] place-items-center rounded-xl border border-dashed border-[var(--mantine-color-default-border)] bg-transparent"
            loading={uploadMutation.isPending}
            maxSize={10 * 1024 * 1024}
            onDrop={(files) => uploadMutation.mutate(files)}
            onReject={() => showNotification({ color: 'red', message: t('locations.photos.rejected') })}
          >
            <div className="pointer-events-none flex flex-col items-center gap-1.5 text-center">
              <AddCircle className="text-[var(--mantine-color-dimmed)]" size={22} />
              <Text fw={600} size="sm">
                {t('locations.photos.add')}
              </Text>
              <Text c="dimmed" size="xs">
                {t('locations.photos.constraints')}
              </Text>
            </div>
          </Dropzone>
        )}
        {readOnly && photos.length === 0 ? (
          <div className="col-span-full grid min-h-32 place-items-center text-center">
            <div className="flex flex-col items-center gap-1.5">
              <Camera className="text-[var(--mantine-color-dimmed)]" size={22} />
              <Text c="dimmed" size="sm">
                {t('locations.photos.none')}
              </Text>
            </div>
          </div>
        ) : null}
      </div>
      {!readOnly && photos.length === 0 ? (
        <div className="border-t border-[var(--mantine-color-default-border)] px-5 py-3">
          <Text c="dimmed" size="xs">
            {t('locations.photos.emptyHint')}
          </Text>
        </div>
      ) : null}
    </section>
  )
}

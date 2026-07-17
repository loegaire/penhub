import type { IntegrationInfo } from "@opencode-ai/sdk/v2"
import { createMemo, createResource, createSignal } from "solid-js"
import { useSDK } from "../context/sdk"
import { useSync } from "../context/sync"
import { DialogSelect, type DialogSelectOption } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { useToast } from "../ui/toast"
import { errorMessage } from "../util/error"

export type ProviderCredential = {
  credentialID: string
  providerID: string
  providerName: string
  label: string
}

export function providerCredentials(integrations: readonly IntegrationInfo[]) {
  return integrations
    .flatMap((integration) =>
      integration.connections
        .filter((connection) => connection.type === "credential")
        .map((connection) => ({
          credentialID: connection.id,
          providerID: integration.id,
          providerName: integration.name,
          label: connection.label,
        })),
    )
    .toSorted((a, b) => a.providerName.localeCompare(b.providerName) || a.label.localeCompare(b.label))
}

export function DialogProviderLogout() {
  const sdk = useSDK()
  const sync = useSync()
  const dialog = useDialog()
  const toast = useToast()
  const [loadError, setLoadError] = createSignal<unknown>()
  const [removing, setRemoving] = createSignal<string>()
  const [integrations] = createResource(() =>
    sdk.client.v2.integration
      .list({}, { throwOnError: true })
      .then((result) => result.data.data)
      .catch((error) => {
        setLoadError(error)
        return []
      }),
  )

  const options = createMemo<DialogSelectOption<ProviderCredential | undefined>[]>(() => {
    if (integrations.loading) return [{ title: "Loading logins...", value: undefined, disabled: true }]
    if (loadError())
      return [
        {
          title: "Could not load provider logins",
          description: errorMessage(loadError()),
          value: undefined,
          disabled: true,
        },
      ]

    const credentials = providerCredentials(integrations() ?? [])
    if (credentials.length === 0) return [{ title: "No stored provider logins", value: undefined, disabled: true }]

    return credentials.map((credential) => ({
      title:
        removing() === credential.credentialID
          ? `Logging out of ${credential.providerName}...`
          : credential.providerName,
      description: credential.label,
      value: credential,
      disabled: removing() !== undefined,
    }))
  })

  async function logout(credential: ProviderCredential) {
    if (removing()) return
    setRemoving(credential.credentialID)
    const result = await sdk.client.v2.credential
      .remove({ credentialID: credential.credentialID }, { throwOnError: true })
      .then(() => ({ success: true as const }))
      .catch((error) => ({ success: false as const, error }))

    if (!result.success) {
      setRemoving(undefined)
      toast.show({
        title: `Could not log out of ${credential.providerName}`,
        message: errorMessage(result.error),
        variant: "error",
      })
      return
    }

    await sdk.client.instance.dispose().catch(() => undefined)
    await sync.bootstrap({ fatal: false }).catch(() => undefined)
    toast.show({ message: `Logged out of ${credential.providerName}`, variant: "info" })
    dialog.clear()
  }

  return (
    <DialogSelect
      title="Log out of a provider"
      options={options()}
      onSelect={(option) => {
        if (option.value) void logout(option.value)
      }}
    />
  )
}

<script setup lang="ts">
/* oxlint-disable no-undef -- Vue compiler macros */
import { computed, ref, watch } from "vue";
import OpSummary from "./OpSummary.vue";
import TokenLogo from "./TokenLogo.vue";
import { useTokensStore, type TokenDetail } from "@/stores/tokens";
import { useTokenOp, readLogoFile } from "@/lib/tokenUi";
import { LIMITS, type TokenMetaAsset } from "@/lib/tokenTx";
import { pushToast } from "@/lib/utils";
import { useT } from "@/locales";

/** Showcase (TokenMeta) form — used by the wizard step 3 and the token card. */
const props = defineProps<{ tokenId: string; symbol: string; current?: TokenDetail | null }>();
const emit = defineEmits<{ (e: "done", txId: string): void }>();
const t = useT();
const tokens = useTokensStore();
const { busy, run } = useTokenOp();

const name = ref(props.current?.meta?.name ?? "");
const description = ref(props.current?.meta?.description ?? "");
const website = ref(props.current?.meta?.website ?? "");
const logo = ref<{ logoType: "svg" | "png"; logo: string; preview: string; size: number } | null>(null);
const logoError = ref("");
watch(() => props.current, (c) => { if (c?.meta && !name.value) { name.value = c.meta.name; description.value = c.meta.description; website.value = c.meta.website; } });

const bytes = (s: string) => new TextEncoder().encode(s).length;
const maxLogo = computed(() => tokens.config?.maxLogoBytes ?? LIMITS.logo);
const websiteOk = computed(() => !website.value || /^https?:\/\/[^\s]+$/i.test(website.value.trim()));
const valid = computed(() =>
  bytes(name.value.trim()) >= 1 && bytes(name.value.trim()) <= LIMITS.metaName &&
  bytes(description.value) <= LIMITS.metaDescription && bytes(website.value) <= LIMITS.metaWebsite && websiteOk.value,
);

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  logoError.value = "";
  if (!f) return;
  try {
    logo.value = await readLogoFile(f, maxLogo.value);
  } catch (err: any) {
    logo.value = null;
    logoError.value = t.value(err?.message === "logo-size" ? "tok.logoTooBig" : err?.message === "logo-unsafe" ? "tok.logoUnsafe" : "tok.logoType").replace("{kb}", String(Math.floor(maxLogo.value / 1024)));
  }
}

async function submit() {
  const meta: TokenMetaAsset = { name: name.value.trim(), description: description.value.trim(), website: website.value.trim() };
  if (logo.value) { meta.logoType = logo.value.logoType; meta.logo = logo.value.logo; }
  const tx = await run(() => tokens.setMeta(props.tokenId, meta));
  if (tx) emit("done", tx.id!);
  else if (!busy.value) pushToast(t.value("tok.errGeneric"), "error");
}
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="token-meta-form">
    <div class="flex items-center gap-3">
      <TokenLogo :src="logo?.preview ?? tokens.logoUrl(current ?? undefined)" :symbol="symbol" :size="56" />
      <div class="flex-1 min-w-0">
        <label class="forge-btn text-[10px] uppercase tracking-[0.15em] px-3 py-2 inline-flex cursor-pointer" data-testid="meta-logo-label">
          {{ t("tok.chooseLogo") }}
          <input type="file" accept=".svg,.png,image/svg+xml,image/png" class="hidden" @change="onFile" data-testid="meta-logo-input" />
        </label>
        <p class="text-[10px] mt-1" :class="logoError ? 'text-rust' : 'text-fiatDim'" data-testid="meta-logo-hint">
          {{ logoError || (logo ? `${logo.logoType.toUpperCase()} · ${logo.size} B` : t("tok.logoHint").replace("{kb}", String(Math.floor(maxLogo / 1024)))) }}
        </p>
      </div>
    </div>
    <div>
      <label class="forge-label">{{ t("tok.metaName") }}</label>
      <input v-model="name" class="forge-input" :maxlength="LIMITS.metaName" :placeholder="symbol" data-testid="meta-name-input" />
      <p class="text-[10px] text-fiatDim mt-1">{{ bytes(name) }}/{{ LIMITS.metaName }} {{ t("tok.bytes") }}</p>
    </div>
    <div>
      <label class="forge-label">{{ t("tok.metaDesc") }}</label>
      <textarea v-model="description" rows="3" class="forge-input resize-none" :placeholder="t('tok.metaDescPh')" data-testid="meta-desc-input" />
      <p class="text-[10px] mt-1" :class="bytes(description) > LIMITS.metaDescription ? 'text-rust' : 'text-fiatDim'">{{ bytes(description) }}/{{ LIMITS.metaDescription }} {{ t("tok.bytes") }}</p>
    </div>
    <div>
      <label class="forge-label">{{ t("tok.metaSite") }}</label>
      <input v-model="website" class="forge-input mono text-xs" placeholder="https://" data-testid="meta-site-input" />
      <p v-if="!websiteOk" class="text-[10px] text-rust mt-1">{{ t("tok.badUrl") }}</p>
    </div>
    <OpSummary
      :rows="[{ label: t('tok.metaName'), value: name || '—', mono: false }, { label: t('tok.token'), value: symbol }]"
      :fee="tokens.fees?.meta ?? '0'"
      :label="t('tok.holdPublish')"
      :disabled="!valid || busy"
      testid="meta-hold-btn"
      @fired="submit"
    />
  </div>
</template>

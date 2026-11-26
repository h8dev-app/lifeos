<script lang="ts">
  import { ICONS } from "../lib/ui/icons";
  import type { IconName } from "../lib/ui/iconNames";

  // Lucide icon by name. Decorative by default (aria-hidden); pass `label`
  // when the icon alone carries the meaning.
  let { name, size = 16, label, stroke = 1.75, class: cls = "" }: {
    name: IconName; size?: number; label?: string; stroke?: number; class?: string;
  } = $props();
  const Cmp = $derived(ICONS[name]);
</script>

<Cmp {size} strokeWidth={stroke} class="icon {cls}" aria-hidden={label ? undefined : "true"} aria-label={label} role={label ? "img" : undefined} />

import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { InventoryItem, ItemInput, Link, Manufacturer, WikiPage } from '../db/repository.ts';

type Section = 'inventory' | 'wiki' | 'settings';
const statuses = ['in_stock', 'borrowed', 'damaged', 'maintenance', 'retired'];
const blankItem: ItemInput = {
  name: '',
  description: '',
  quantity: 1,
  location: '',
  manufacturerId: null,
  status: 'in_stock',
  borrowedTo: null,
  borrowedAt: null,
  tags: [],
  photos: [],
  links: [],
  wikiPageIds: [],
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { headers: { 'content-type': 'application/json' }, ...init });
  if (!response.ok) {
    throw new Error((await response.json().catch(() => ({}))).error ?? 'Request failed');
  }
  return response.status === 204 ? undefined as T : response.json();
}

async function uploadImages(files: FileList | File[]) {
  const data = new FormData();
  for (const file of Array.from(files)) data.append('photos', file);
  const response = await fetch('/api/uploads', { method: 'POST', body: data });
  if (!response.ok) throw new Error((await response.json()).error ?? 'Upload failed');
  return (await response.json() as { paths: string[] }).paths;
}

export default function InventoryApp({ authenticated, initialItems }: { authenticated: boolean; initialItems: InventoryItem[] }) {
  if (!authenticated) return <AccessGate />;
  const [section, setSection] = useState<Section>('inventory');
  const [items, setItems] = useState(initialItems);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [wikiId, setWikiId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    void Promise.all([
      request<Manufacturer[]>('/api/manufacturers'),
      request<WikiPage[]>('/api/wiki'),
    ]).then(([makers, wiki]) => {
      setManufacturers(makers);
      setPages(wiki);
    }).catch((reason) => setError(reason.message));
  }, []);
  const filtered = items.filter((item) =>
    [
      item.name,
      item.description,
      item.location,
      item.manufacturerName,
      item.status,
      item.borrowedTo,
      ...item.tags,
      ...item.links.flatMap((link) => [link.label, link.url]),
    ].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase())
  );
  const refreshItems = async () => setItems(await request<InventoryItem[]>('/api/items'));
  const refreshWiki = async () => setPages(await request<WikiPage[]>('/api/wiki'));
  const saveItem = async (input: ItemInput, id?: number) => {
    await request<InventoryItem>(id ? `/api/items/${id}` : '/api/items', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(input),
    });
    await refreshItems();
    setSelected(null);
  };
  const openWiki = (id: number) => {
    setSelected(null);
    setWikiId(id);
    setSection('wiki');
  };
  return (
    <div class='min-h-screen bg-stone-100 text-stone-900'>
      <header class='flex items-center justify-between border-b border-stone-200 bg-white px-4 py-4 lg:hidden'>
        <h1 class='font-display text-2xl font-bold'>Garagio</h1>
        <LogoutButton />
      </header>
      <div class='mx-auto flex min-h-screen max-w-7xl'>
        <aside class='hidden w-50 shrink-0 border-r border-stone-200 bg-white p-6 lg:block'>
          <h1 class='font-display text-3xl font-bold'>Garagio</h1>
          <p class='mt-1 text-sm text-stone-500'>Workshop inventory</p>
          <Navigation section={section} setSection={setSection} />
          <div class='mt-10 border-t border-stone-200 pt-4'><LogoutButton /></div>
        </aside>
        <main class='min-w-0 flex-1 px-2 pb-24 pt-5 sm:px-7 lg:pb-8 lg:pt-8'>
          {error && (
            <p class='mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700'>{error}</p>
          )}
          {section === 'inventory' && (
            <InventoryView
              items={filtered}
              query={query}
              setQuery={setQuery}
              select={setSelected}
              create={() => setSelected({ ...blankItem, id: 0, manufacturerName: null })}
            />
          )}
          {section === 'wiki' && (
            <WikiWorkspace
              pages={pages}
              items={items}
              selectedId={wikiId}
              select={setWikiId}
              refresh={refreshWiki}
              openItem={(item) => {
                setSelected(item);
                setSection('inventory');
              }}
            />
          )}
          {section === 'settings' && (
            <SettingsView
              manufacturers={manufacturers}
              refresh={async () =>
                setManufacturers(await request<Manufacturer[]>('/api/manufacturers'))}
            />
          )}
        </main>
      </div>
      <nav class='fixed bottom-0 left-0 right-0 z-20 flex border-t border-stone-200 bg-white lg:hidden'>
        <Navigation section={section} setSection={setSection} compact />
      </nav>
      {selected && (
        <ItemSheet
          item={selected}
          manufacturers={manufacturers}
          pages={pages}
          openWiki={openWiki}
          close={() => setSelected(null)}
          save={saveItem}
          remove={async () => {
            if (selected.id) await request(`/api/items/${selected.id}`, { method: 'DELETE' });
            await refreshItems();
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

function AccessGate() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const login = async (event: Event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) });
      localStorage.setItem('garagio_authenticated', 'true');
      location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };
  return <main class='grid min-h-screen place-items-center bg-stone-100 p-5'><form onSubmit={(event) => void login(event)} class='w-full max-w-sm border border-stone-200 bg-white p-6 shadow-sm'><h1 class='font-display text-3xl font-bold'>Garagio</h1><p class='mt-1 text-sm text-stone-500'>Enter the workshop access password.</p>{error && <p class='mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700'>{error}</p>}<label class='mt-6 grid gap-2 text-sm font-bold text-stone-700'><span>Password</span><input type='password' value={password} onInput={(event) => setPassword(event.currentTarget.value)} class='min-h-12 border border-stone-300 px-3 outline-none focus:border-emerald-700' autoFocus /></label><button disabled={submitting || !password} class='mt-4 min-h-12 w-full bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50'>{submitting ? 'Checking...' : 'Unlock Garagio'}</button></form></main>;
}

function LogoutButton() {
  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('garagio_authenticated');
    location.reload();
  };
  return <button type='button' onClick={() => void logout()} class='min-h-10 px-3 text-sm font-bold text-stone-600 hover:bg-stone-100'>Log out</button>;
}

function Navigation(
  { section, setSection, compact = false }: {
    section: Section;
    setSection: (section: Section) => void;
    compact?: boolean;
  },
) {
  return (
    <div class={compact ? 'grid w-full grid-cols-3' : 'mt-10 space-y-1'}>
      {(['inventory', 'wiki', 'settings'] as Section[]).map((name) => (
        <button
          type='button'
          onClick={() => setSection(name)}
          class={`min-h-12 px-3 text-sm font-semibold capitalize ${
            section === name ? 'bg-emerald-700 text-white' : 'text-stone-600 hover:bg-stone-100'
          } ${compact ? '' : 'w-full text-left'}`}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
function InventoryView(
  { items, query, setQuery, select, create }: {
    items: InventoryItem[];
    query: string;
    setQuery: (value: string) => void;
    select: (item: InventoryItem) => void;
    create: () => void;
  },
) {
  return (
    <>
      <div class='flex items-center justify-between gap-4'>
        <div>
          <h2 class='font-display text-3xl font-bold'>Inventory</h2>
          <p class='mt-1 text-sm text-stone-500'>{items.length} tools and supplies</p>
        </div>
        <button
          type='button'
          onClick={create}
          class='min-h-11 bg-emerald-700 px-4 text-sm font-bold text-white'
        >
          Add item
        </button>
      </div>
      <input
        value={query}
        onInput={(event) => setQuery(event.currentTarget.value)}
        placeholder='Search name, manufacturer, status, tags, location...'
        class='mt-6 min-h-12 w-full border border-stone-300 bg-white px-4 text-base outline-none focus:border-emerald-700'
      />
      <div class='mt-4 divide-y divide-stone-200 border-y border-stone-200 bg-white'>
        {items.map((item) => (
          <button
            type='button'
            onClick={() => select(item)}
            class='grid w-full grid-cols-[3.5rem_1fr_auto] items-center gap-3 px-4 py-3 text-left hover:bg-stone-50'
          >
            <div class='h-14 w-14 overflow-hidden bg-stone-100'>
              {item.photos[0]
                ? <img src={item.photos[0]} alt='' class='h-full w-full object-cover' />
                : (
                  <span class='flex h-full items-center justify-center text-xs text-stone-400'>
                    No photo
                  </span>
                )}
            </div>
            <span>
              <strong class='block'>{item.name}</strong>
              <span class='mt-1 block text-sm text-stone-500'>
                {item.manufacturerName ? `${item.manufacturerName} · ` : ''}
                {item.location || 'No location'}
                {item.tags.length ? ` · ${item.tags.join(', ')}` : ''}
              </span>
            </span>
            <span
              class={`h-fit px-2 py-1 text-xs font-bold ${
                item.status === 'in_stock'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {item.quantity} · {item.status.replace('_', ' ')}
            </span>
          </button>
        ))}
        {items.length === 0 && <p class='p-8 text-center text-stone-500'>No matching items yet.</p>}
      </div>
    </>
  );
}

function ItemSheet({
  item,
  manufacturers,
  pages,
  openWiki,
  close,
  save,
  remove,
}: {
  item: InventoryItem;
  manufacturers: Manufacturer[];
  pages: WikiPage[];
  openWiki: (id: number) => void;
  close: () => void;
  save: (input: ItemInput, id?: number) => Promise<void>;
  remove: () => Promise<void>;
}) {
  const [form, setForm] = useState<ItemInput>({ ...item });
  const [tagDraft, setTagDraft] = useState(item.tags.join(', '));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const change = <K extends keyof ItemInput>(key: K, value: ItemInput[K]) =>
    setForm({ ...form, [key]: value });
  const addPhotos = async (files: FileList | File[]) => {
    if (!files.length) return;
    setUploading(true);
    try {
      change('photos', [...form.photos, ...await uploadImages(files)]);
    } finally {
      setUploading(false);
    }
  };
  return (
    <div class='fixed inset-0 z-30 bg-stone-950/35' onClick={close}>
      <section
        class='absolute inset-x-0 bottom-0 max-h-[92vh] overflow-auto bg-white p-5 shadow-2xl lg:inset-y-0 lg:left-auto lg:w-[42rem]'
        onClick={(event) => event.stopPropagation()}
      >
        <div class='flex items-center justify-between'>
          <h2 class='font-display text-2xl font-bold'>{item.id ? 'Edit item' : 'New item'}</h2>
          <button
            type='button'
            onClick={close}
            class='min-h-10 px-3 text-sm font-bold text-stone-600'
          >
            Close
          </button>
        </div>
        <div class='mt-6 grid gap-4'>
          <Field label='Name'>
            <input
              autoFocus
              value={form.name}
              onInput={(event) => change('name', event.currentTarget.value)}
            />
          </Field>
          <Field label='Description'>
            <textarea
              value={form.description}
              onInput={(event) => change('description', event.currentTarget.value)}
            />
          </Field>
          <div class='grid grid-cols-2 gap-4'>
            <Field label='Quantity'>
              <input
                type='number'
                min='0'
                value={form.quantity}
                onInput={(event) => change('quantity', Number(event.currentTarget.value))}
              />
            </Field>
            <Field label='Location'>
              <input
                value={form.location}
                onInput={(event) => change('location', event.currentTarget.value)}
              />
            </Field>
          </div>
          <div class='grid grid-cols-2 gap-4'>
            <Field label='Status'>
              <select
                value={form.status}
                onChange={(event) => change('status', event.currentTarget.value)}
              >
                {statuses.map((status) => <option value={status}>{status.replace('_', ' ')}
                </option>)}
              </select>
            </Field>
            <Field label='Manufacturer'>
              <select
                value={form.manufacturerId ?? ''}
                onChange={(event) =>
                  change(
                    'manufacturerId',
                    event.currentTarget.value ? Number(event.currentTarget.value) : null,
                  )}
              >
                <option value=''>None</option>
                {manufacturers.map((manufacturer) => (
                  <option value={manufacturer.id}>{manufacturer.name}</option>
                ))}
              </select>
            </Field>
          </div>
          {form.status === 'borrowed' && (
            <div class='grid grid-cols-2 gap-4'>
              <Field label='Borrowed to'>
                <input
                  value={form.borrowedTo ?? ''}
                  onInput={(event) => change('borrowedTo', event.currentTarget.value || null)}
                />
              </Field>
              <Field label='Borrowed date'>
                <input
                  type='date'
                  value={form.borrowedAt ?? ''}
                  onInput={(event) => change('borrowedAt', event.currentTarget.value || null)}
                />
              </Field>
            </div>
          )}
          <Field label='Tags (comma separated)'>
            <input value={tagDraft} onInput={(event) => setTagDraft(event.currentTarget.value)} />
          </Field>
          <Field label='Photos'>
            <input
              type='file'
              accept='image/*'
              multiple
              onChange={(event) => void addPhotos(event.currentTarget.files ?? [])}
            />
            {uploading && <span class='text-sm font-normal text-stone-500'>Uploading...</span>}
            {form.photos.length > 0 && (
              <div class='mt-2 grid grid-cols-3 gap-2'>
                {form.photos.map((photo) => (
                  <div class='relative aspect-square overflow-hidden bg-stone-100'>
                    <img src={photo} alt='' class='h-full w-full object-cover' />
                    <button
                      type='button'
                      onClick={() => change('photos', form.photos.filter((path) => path !== photo))}
                      class='absolute right-1 top-1 h-7 w-7 bg-white/90 text-lg leading-none text-stone-800'
                      aria-label='Remove photo'
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Field>
          <LinkEditor links={form.links} change={(links) => change('links', links)} />
          <WikiLinks
            pages={pages}
            selected={form.wikiPageIds}
            change={(ids) => change('wikiPageIds', ids)}
            open={openWiki}
          />
        </div>
        <div class='mt-7 flex justify-between gap-3'>
          {item.id
            ? (
              <button
                type='button'
                onClick={() => void remove()}
                class='min-h-11 px-3 text-sm font-bold text-red-700'
              >
                Delete
              </button>
            )
            : <span />}
          <button
            type='button'
            disabled={saving || uploading || !form.name.trim()}
            onClick={() => {
              setSaving(true);
              void save({
                ...form,
                tags: tagDraft.split(',').map((tag) => tag.trim()).filter(Boolean),
              }, item.id || undefined).finally(() => setSaving(false));
            }}
            class='min-h-11 bg-emerald-700 px-5 text-sm font-bold text-white disabled:opacity-50'
          >
            {saving ? 'Saving...' : 'Save item'}
          </button>
        </div>
      </section>
    </div>
  );
}

function LinkEditor({ links, change }: { links: Link[]; change: (links: Link[]) => void }) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const add = () => {
    if (!label.trim() || !url.trim()) return;
    change([...links, { label: label.trim(), url: url.trim() }]);
    setLabel('');
    setUrl('');
  };
  return (
    <fieldset class='grid gap-2'>
      <legend class='text-sm font-semibold text-stone-700'>Links</legend>
      <div class='grid grid-cols-[1fr_1fr_auto] gap-2'>
        <input
          class='min-h-11 min-w-0 border border-stone-300 px-3'
          value={label}
          onInput={(event) => setLabel(event.currentTarget.value)}
          placeholder='Label'
        />
        <input
          class='min-h-11 min-w-0 border border-stone-300 px-3'
          value={url}
          onInput={(event) => setUrl(event.currentTarget.value)}
          placeholder='https://...'
        />
        <button
          type='button'
          onClick={add}
          class='min-h-11 bg-stone-800 px-3 text-sm font-bold text-white'
        >
          Add
        </button>
      </div>
      {links.length > 0 && (
        <ul class='divide-y divide-stone-200 border border-stone-200 bg-white'>
          {links.map((link, index) => (
            <li class='flex min-h-11 items-center gap-2 px-3'>
              <a
                class='min-w-0 flex-1 truncate text-sm text-emerald-800 underline'
                href={link.url}
                target='_blank'
                rel='noreferrer'
              >
                {link.label}
              </a>
              <button
                type='button'
                onClick={() => change(links.filter((_link, position) => position !== index))}
                class='px-2 text-sm font-bold text-red-700'
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
function WikiLinks(
  { pages, selected, change, open }: {
    pages: WikiPage[];
    selected: number[];
    change: (ids: number[]) => void;
    open: (id: number) => void;
  },
) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedPages = pages.filter((page) => selected.includes(page.id));
  return (
    <fieldset class='grid gap-2'>
      <div class='flex items-center justify-between'>
        <legend class='text-sm font-semibold text-stone-700'>Related wiki pages</legend>
        <button
          type='button'
          onClick={() => setPickerOpen(!pickerOpen)}
          class='min-h-9 border border-stone-300 px-3 text-sm font-bold'
        >
          {pickerOpen ? 'Done' : 'Link pages'}
        </button>
      </div>
      {selectedPages.length > 0 && (
        <div class='flex flex-wrap gap-2'>
          {selectedPages.map((page) => (
            <button
              type='button'
              onClick={() => open(page.id)}
              class='min-h-9 bg-emerald-100 px-3 text-sm font-semibold text-emerald-900'
            >
              {page.title}
            </button>
          ))}
        </div>
      )}
      {pickerOpen && (
        <div class='max-h-44 overflow-auto border border-stone-300 bg-white'>
          {pages.length
            ? pages.map((page) => (
              <label class='flex min-h-11 items-center gap-3 border-b border-stone-100 px-3 last:border-0'>
                <input
                  type='checkbox'
                  checked={selected.includes(page.id)}
                  onChange={(event) =>
                    change(
                      event.currentTarget.checked
                        ? [...selected, page.id]
                        : selected.filter((id) => id !== page.id),
                    )}
                />
                <span class='text-sm'>{page.title}</span>
              </label>
            ))
            : <p class='p-3 text-sm text-stone-500'>Create wiki pages to link them here.</p>}
        </div>
      )}
    </fieldset>
  );
}

function WikiWorkspace(
  { pages, items, selectedId, select, refresh, openItem }: {
    pages: WikiPage[];
    items: InventoryItem[];
    selectedId: number | null;
    select: (id: number | null) => void;
    refresh: () => Promise<void>;
    openItem: (item: InventoryItem) => void;
  },
) {
  const selected = pages.find((page) => page.id === selectedId) ?? null;
  const linkedItems = selected ? items.filter((item) => item.wikiPageIds.includes(selected.id)) : [];
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const filteredPages = pages.filter((page) =>
    `${page.title} ${page.content}`.toLowerCase().includes(search.toLowerCase())
  );
  const begin = (page: WikiPage | null) => {
    setTitle(page?.title ?? '');
    setContent(page?.content ?? '');
    setEditing(true);
    select(page?.id ?? null);
  };
  const save = async () => {
    const page = selected
      ? await request<WikiPage>(`/api/wiki/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({ title, content }),
      })
      : await request<WikiPage>('/api/wiki', {
        method: 'POST',
        body: JSON.stringify({ title, content }),
      });
    await refresh();
    select(page.id);
    setEditing(false);
  };
  const addImages = async (files: FileList | File[]) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const paths = await uploadImages(files);
      setContent((value) =>
        `${value.trimEnd()}${value.trim() ? '\n\n' : ''}${
          paths.map((path) => `![](${path})`).join('\n\n')
        }\n\n`
      );
    } finally {
      setUploading(false);
    }
  };
  return (
    <section>
      <div class='flex items-center justify-between gap-3'>
        <div>
          <h2 class='font-display text-3xl font-bold'>Wiki</h2>
          <p class='mt-1 text-sm text-stone-500'>Notes, manuals, and workshop knowledge</p>
        </div>
        <button
          type='button'
          onClick={() => begin(null)}
          class='min-h-11 bg-emerald-700 px-4 text-sm font-bold text-white'
        >
          New page
        </button>
      </div>
      <div class='mt-6 grid gap-5 lg:grid-cols-[15rem_1fr]'>
        <aside class='border border-stone-200 bg-white'>
          <div class='border-b border-stone-200 p-3'>
            <input
              value={search}
              onInput={(event) => setSearch(event.currentTarget.value)}
              placeholder='Search wiki pages'
              class='min-h-10 w-full border border-stone-300 px-3 text-sm outline-none focus:border-emerald-700'
            />
          </div>
          <div class='max-h-60 overflow-y-auto'>
            {filteredPages.length
              ? filteredPages.map((page) => (
                <button
                  type='button'
                  onClick={() => {
                    select(page.id);
                    setEditing(false);
                  }}
                  class={`block min-h-12 w-full border-b border-stone-100 px-4 text-left text-sm font-semibold ${
                    selected?.id === page.id ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-stone-50'
                  }`}
                >
                  {page.title}
                </button>
              ))
              : <p class='p-4 text-sm text-stone-500'>{pages.length ? 'No matching pages.' : 'No pages yet.'}</p>}
          </div>
        </aside>
        <div>
          {editing
            ? (
              <WikiEditor
                title={title}
                content={content}
                setTitle={setTitle}
                setContent={setContent}
                uploading={uploading}
                addImages={addImages}
                cancel={() => {
                  setEditing(false);
                  if (!selected) select(null);
                }}
                save={save}
              />
            )
            : selected
            ? (
              <article class='border border-stone-200 bg-white p-5'>
                <div class='flex items-start justify-between gap-4'>
                  <h3 class='font-display text-2xl font-bold'>{selected.title}</h3>
                  <div class='flex gap-2'>
                    <button
                      type='button'
                      onClick={() => begin(selected)}
                      class='min-h-10 border border-stone-300 px-3 text-sm font-bold'
                    >
                      Edit
                    </button>
                    <button
                      type='button'
                      onClick={() => {
                        if (confirm(`Delete ${selected.title}?`)) {
                          void request(`/api/wiki/${selected.id}`, { method: 'DELETE' }).then(
                            async () => {
                              await refresh();
                              select(null);
                            },
                          );
                        }
                      }}
                      class='min-h-10 px-3 text-sm font-bold text-red-700'
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <MarkdownPreview content={selected.content} />
                {linkedItems.length > 0 && (
                  <section class='mt-8 border-t border-stone-200 pt-5'>
                    <h4 class='text-sm font-bold uppercase tracking-wide text-stone-500'>Linked inventory</h4>
                    <div class='mt-3 grid gap-2 sm:grid-cols-2'>
                      {linkedItems.map((item) => (
                        <button
                          type='button'
                          onClick={() => openItem(item)}
                          class='flex min-h-14 items-center gap-3 border border-stone-200 bg-stone-50 p-2 text-left hover:border-emerald-700 hover:bg-emerald-50'
                        >
                          <div class='h-10 w-10 shrink-0 overflow-hidden bg-stone-200'>
                            {item.photos[0] && <img src={item.photos[0]} alt='' class='h-full w-full object-cover' />}
                          </div>
                          <span class='min-w-0'>
                            <strong class='block truncate text-sm'>{item.name}</strong>
                            <span class='block truncate text-xs text-stone-500'>{item.location || 'No location'}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </article>
            )
            : (
              <div class='border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500'>
                Choose a page or create a new one.
              </div>
            )}
        </div>
      </div>
    </section>
  );
}
function WikiEditor({
  title,
  content,
  setTitle,
  setContent,
  uploading,
  addImages,
  cancel,
  save,
}: {
  title: string;
  content: string;
  setTitle: (value: string) => void;
  setContent: (value: string) => void;
  uploading: boolean;
  addImages: (files: FileList | File[]) => Promise<void>;
  cancel: () => void;
  save: () => Promise<void>;
}) {
  return (
    <div class='border border-stone-200 bg-white p-5'>
      <input
        class='min-h-12 w-full border-b border-stone-300 text-2xl font-bold outline-none focus:border-emerald-700'
        value={title}
        onInput={(event) => setTitle(event.currentTarget.value)}
        placeholder='Page title'
      />
      <div class='mt-4 grid gap-4 lg:grid-cols-2'>
        <textarea
          class='min-h-80 w-full border border-stone-300 p-3 font-mono text-sm'
          value={content}
          onInput={(event) => setContent(event.currentTarget.value)}
          onDrop={(event) => {
            event.preventDefault();
            void addImages(event.dataTransfer?.files ?? []);
          }}
          onDragOver={(event) => event.preventDefault()}
          placeholder='Write Markdown here. Drop images into this editor to upload them.'
        />
        <div class='min-h-80 border border-stone-200 p-4'>
          <MarkdownPreview content={content} />
        </div>
      </div>
      <div class='mt-4 flex flex-wrap items-center justify-between gap-3'>
        <label class='min-h-11 border border-stone-300 px-3 py-2 text-sm font-bold'>
          <input
            class='sr-only'
            type='file'
            accept='image/*'
            multiple
            onChange={(event) => void addImages(event.currentTarget.files ?? [])}
          />
          {uploading ? 'Uploading...' : 'Add images'}
        </label>
        <div class='flex gap-2'>
          <button type='button' onClick={cancel} class='min-h-11 px-3 text-sm font-bold'>
            Cancel
          </button>
          <button
            type='button'
            disabled={!title.trim() || uploading}
            onClick={() => void save()}
            class='min-h-11 bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50'
          >
            Save page
          </button>
        </div>
      </div>
    </div>
  );
}
function MarkdownPreview({ content }: { content: string }) {
  const blocks = content
    .replace(/^(!\[[^\]]*\]\([^ )]+\))\s*$/gm, '\n\n$1\n\n')
    .split(/\n{2,}/)
    .filter(Boolean);
  return (
    <div class='prose mt-5 max-w-none text-stone-700'>
      {blocks.map((block) => {
        const image = /^!\[([^\]]*)\]\(([^ )]+)\)$/.exec(block.trim());
        if (image) {
          return (
            <img src={image[2]} alt={image[1]} class='my-3 max-h-96 max-w-full object-contain' />
          );
        }
        const heading = /^(#{1,3})\s+(.+)$/.exec(block.trim());
        if (heading) {
          return (
            <h4
              class={heading[1].length === 1 ? 'mt-5 text-2xl font-bold' : 'mt-4 text-lg font-bold'}
            >
              {heading[2]}
            </h4>
          );
        }
        return <p class='my-3 whitespace-pre-wrap leading-7'>{inlineMarkdown(block)}</p>;
      })}
    </div>
  );
}
function inlineMarkdown(value: string): ComponentChildren {
  const segments = value.split(/(\[[^\]]+\]\([^ )]+\)|(?:https?:\/\/|www\.)[^\s<>()]+)/g);
  return segments.map((segment) => {
    const match = /^\[([^\]]+)\]\(([^ )]+)\)$/.exec(segment);
    if (match) {
      return <a href={match[2]} target='_blank' rel='noreferrer' class='text-emerald-800 underline'>{match[1]}</a>;
    }
    if (/^(https?:\/\/|www\.)/.test(segment)) {
      const url = segment.replace(/[.,!?;:]+$/, '');
      const trailingPunctuation = segment.slice(url.length);
      return <>{url && <a href={url.startsWith('www.') ? `https://${url}` : url} target='_blank' rel='noreferrer' class='text-emerald-800 underline'>{url}</a>}{trailingPunctuation}</>;
    }
    return segment;
  });
}
function Field({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <label class='grid gap-1.5 text-sm font-semibold text-stone-700'>
      <span>{label}</span>
      <span class='[&>input:not([type=file])]:min-h-11 [&>input:not([type=file])]:w-full [&>input:not([type=file])]:border [&>input:not([type=file])]:border-stone-300 [&>input:not([type=file])]:px-3 [&>select]:min-h-11 [&>select]:w-full [&>select]:border [&>select]:border-stone-300 [&>select]:px-3 [&>textarea]:min-h-24 [&>textarea]:w-full [&>textarea]:border [&>textarea]:border-stone-300 [&>textarea]:p-3'>
        {children}
      </span>
    </label>
  );
}
function SettingsView(
  { manufacturers, refresh }: { manufacturers: Manufacturer[]; refresh: () => Promise<void> },
) {
  const [name, setName] = useState('');
  return (
    <section>
      <h2 class='font-display text-3xl font-bold'>Settings</h2>
      <h3 class='mt-8 text-lg font-bold'>Manufacturers</h3>
      <form
        class='mt-3 flex gap-2'
        onSubmit={(event) => {
          event.preventDefault();
          void request('/api/manufacturers', {
            method: 'POST',
            body: JSON.stringify({ name, website: null, notes: null }),
          }).then(() => {
            setName('');
            return refresh();
          });
        }}
      >
        <input
          class='min-h-11 flex-1 border border-stone-300 px-3'
          value={name}
          onInput={(event) => setName(event.currentTarget.value)}
          placeholder='Add manufacturer'
        />
        <button class='min-h-11 bg-emerald-700 px-4 text-sm font-bold text-white'>Add</button>
      </form>
      <ul class='mt-4 divide-y divide-stone-200 border-y border-stone-200 bg-white'>
        {manufacturers.map((manufacturer) => (
          <li class='flex items-center justify-between gap-4 p-4'>
            <span>{manufacturer.name}</span>
            <button
              type='button'
              class='min-h-9 px-2 text-sm font-bold text-red-700'
              onClick={() =>
                void request(`/api/manufacturers/${manufacturer.id}`, { method: 'DELETE' }).then(
                  refresh,
                )}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

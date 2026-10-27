const SUPABASE_URL = "https://sfpdvmrxxrzonicargst.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_VTdw4aRSDAAXqVJoyLwZ_Q_Wrgo77cN";

const authScreen = document.querySelector("#auth-screen");
const appShell = document.querySelector("#app-shell");
const authForm = document.querySelector("#auth-form");
const authTitle = document.querySelector("#auth-title");
const authSubmit = document.querySelector("#auth-submit");
const authMessage = document.querySelector("#auth-message");
const authModeToggle = document.querySelector("#auth-mode-toggle");
const authSwitchLabel = document.querySelector("#auth-switch-label");
const profileForm = document.querySelector("#profile-form");
const profileMessage = document.querySelector("#profile-message");
const rosterList = document.querySelector("#roster-list");
const rosterMessage = document.querySelector("#roster-message");
const eventForm = document.querySelector("#event-form");
const eventMessage = document.querySelector("#event-message");
const eventSubmit = document.querySelector("#event-submit");
const eventCancelEdit = document.querySelector("#event-cancel-edit");
const calendarMessage = document.querySelector("#calendar-message");
const eventsList = document.querySelector("#events-list");
const calendarDays = document.querySelector("#calendar-days");
const calendarMonthLabel = document.querySelector("#calendar-month-label");
const selectedDayTitle = document.querySelector("#selected-day-title");

let supabaseClient;
let currentUser;
let isRegisterMode = false;
let calendarEvents = [];
let currentCalendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedCalendarDate = new Date();
let editingEventId = null;

function setMessage(element, message, kind = "") {
  element.textContent = message;
  if (kind) {
    element.dataset.kind = kind;
  } else {
    delete element.dataset.kind;
  }
}

function setAuthenticatedView(user) {
  currentUser = user ?? undefined;
  authScreen.classList.toggle("is-hidden", Boolean(user));
  appShell.classList.toggle("is-hidden", !user);

  if (user) {
    document.querySelector("#signed-in-email").textContent = user.email ?? "";
    loadProfile();
  }
}

function setAuthMode(registerMode) {
  isRegisterMode = registerMode;
  authTitle.textContent = registerMode ? "Dołącz do Paktu" : "Witaj, wojowniku";
  authSubmit.textContent = registerMode ? "Utwórz konto" : "Zaloguj się";
  authSwitchLabel.textContent = registerMode ? "Masz już konto?" : "Nie masz jeszcze konta?";
  authModeToggle.textContent = registerMode ? "Zaloguj się" : "Zarejestruj się";
  document.querySelector("#auth-password").autocomplete = registerMode ? "new-password" : "current-password";
  setMessage(authMessage, "");
}

async function loadProfile() {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("character_name, race, character_class, role, profession")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    setMessage(profileMessage, `Nie udało się pobrać karty postaci: ${error.message}`, "error");
    return;
  }

  profileForm.elements.character_name.value = data?.character_name ?? "";
  profileForm.elements.race.value = data?.race ?? "";
  profileForm.elements.character_class.value = data?.character_class ?? "";
  profileForm.elements.role.value = data?.role ?? "";
  profileForm.elements.profession.value = data?.profession ?? "";
  setMessage(profileMessage, "");
}

function createRosterCard(profile) {
  const card = document.createElement("article");
  card.className = "roster-card";

  const name = document.createElement("h4");
  name.className = "roster-card__name";
  name.textContent = profile.character_name;

  const details = document.createElement("div");
  details.className = "roster-card__details";
  [
    ["Rasa", profile.race],
    ["Klasa", profile.character_class],
    ["Rola", profile.role],
    ["Profesja", profile.profession],
  ].forEach(([label, value]) => {
    const item = document.createElement("p");
    const itemLabel = document.createElement("span");
    itemLabel.className = "roster-card__label";
    itemLabel.textContent = `${label}: `;
    item.append(itemLabel, document.createTextNode(value || "—"));
    details.append(item);
  });

  card.append(name, details);
  return card;
}

async function loadRoster() {
  if (!currentUser) return;

  setMessage(rosterMessage, "Wczytywanie członków gildii...");
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("user_id, character_name, race, character_class, role, profession")
    .order("character_name", { ascending: true });

  if (error) {
    setMessage(rosterMessage, `Nie udało się pobrać członków gildii: ${error.message}`, "error");
    return;
  }

  if (!data?.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "Nie ma jeszcze uzupełnionych kart postaci.";
    rosterList.replaceChildren(emptyState);
  } else {
    rosterList.replaceChildren(...data.map(createRosterCard));
  }
  setMessage(rosterMessage, "");
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getEventsForDate(date) {
  const dateKey = getLocalDateKey(date);
  return calendarEvents.filter((event) => getLocalDateKey(new Date(event.starts_at)) === dateKey);
}

function renderCalendar() {
  const year = currentCalendarMonth.getFullYear();
  const month = currentCalendarMonth.getMonth();
  calendarMonthLabel.textContent = currentCalendarMonth.toLocaleDateString("pl-PL", {
    month: "long",
    year: "numeric",
  });
  calendarMonthLabel.textContent = calendarMonthLabel.textContent.replace(/^./, (letter) => letter.toLocaleUpperCase("pl-PL"));

  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - firstDayOffset);
  const todayKey = getLocalDateKey(new Date());
  const selectedKey = getLocalDateKey(selectedCalendarDate);
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    const dateKey = getLocalDateKey(date);
    const dayEvents = getEventsForDate(date);
    const dayButton = document.createElement("button");
    dayButton.type = "button";
    dayButton.className = "calendar-day";
    dayButton.textContent = String(date.getDate());
    dayButton.setAttribute("aria-label", `${date.toLocaleDateString("pl-PL", { dateStyle: "full" })}${dayEvents.length ? `, wydarzeń: ${dayEvents.length}` : ""}`);
    dayButton.setAttribute("aria-pressed", String(dateKey === selectedKey));

    if (date.getMonth() !== month) dayButton.classList.add("calendar-day--outside");
    if (dateKey === todayKey) dayButton.classList.add("calendar-day--today");
    if (dateKey === selectedKey) dayButton.classList.add("calendar-day--selected");
    if (dayEvents.length) {
      dayButton.classList.add("calendar-day--has-events");
      const eventCount = document.createElement("span");
      eventCount.className = "calendar-day__count";
      eventCount.textContent = String(dayEvents.length);
      eventCount.setAttribute("aria-hidden", "true");
      dayButton.append(eventCount);
    }

    dayButton.addEventListener("click", () => {
      selectedCalendarDate = date;
      if (date.getMonth() !== currentCalendarMonth.getMonth() || date.getFullYear() !== currentCalendarMonth.getFullYear()) {
        currentCalendarMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      }
      renderCalendar();
      renderSelectedDayEvents();
    });
    fragment.append(dayButton);
  }

  calendarDays.replaceChildren(fragment);
}

function createEventCard(event) {
  const card = document.createElement("article");
  card.className = "event-card";

  const eventTime = new Date(event.starts_at).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const heading = document.createElement("div");
  heading.className = "event-card__heading";

  const title = document.createElement("h4");
  title.textContent = event.title;
  const time = document.createElement("time");
  time.className = "event-meta";
  time.dateTime = event.starts_at;
  time.textContent = eventTime;
  heading.append(title, time);
  card.append(heading);

  if (event.description) {
    const description = document.createElement("p");
    description.className = "event-description";
    description.textContent = event.description;
    card.append(description);
  }

  const attendees = document.createElement("p");
  attendees.className = "event-attendees";
  const attendeeLabel = document.createElement("strong");
  attendeeLabel.textContent = "Zapisani: ";
  attendees.append(attendeeLabel);
  const attendeeList = document.createElement("span");
  attendeeList.className = "event-attendees__list";
  const signups = event.event_signups ?? [];
  if (signups.length) {
    signups.forEach((signup) => {
      const attendee = document.createElement("span");
      attendee.className = "attendee";
      const characterName = document.createElement("span");
      characterName.className = "attendee__name";
      characterName.textContent = signup.character_name || signup.user_id;
      const characterClass = document.createElement("span");
      const classToken = (signup.character_class ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "");
      characterClass.className = `attendee__class${classToken ? ` attendee__class--${classToken}` : ""}`;
      characterClass.textContent = signup.character_class || "Klasa nieustawiona";
      const role = document.createElement("span");
      const roleToken = (signup.role ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "");
      role.className = `attendee__role${roleToken ? ` attendee__role--${roleToken}` : ""}`;
      role.textContent = signup.role || "Rola nieustawiona";
      attendee.append(characterName, characterClass, role);
      attendeeList.append(attendee);
    });
  } else {
    attendeeList.textContent = "Brak zapisanych osób";
  }
  attendees.append(attendeeList);
  card.append(attendees);

  const signupButton = document.createElement("button");
  signupButton.className = "button button--secondary";
  signupButton.type = "button";
  signupButton.textContent = "Zapisz się";
  signupButton.addEventListener("click", () => signUpForEvent(event.id, signupButton));
  if (event.event_signups?.some((signup) => signup.user_id === currentUser.id)) {
    signupButton.disabled = true;
    signupButton.textContent = "Już zapisano";
  }
  card.append(signupButton);

  if (event.created_by === currentUser.id) {
    const ownerActions = document.createElement("div");
    ownerActions.className = "event-owner-actions";

    const editButton = document.createElement("button");
    editButton.className = "button button--secondary";
    editButton.type = "button";
    editButton.textContent = "Edytuj";
    editButton.addEventListener("click", () => startEventEdit(event));

    const deleteButton = document.createElement("button");
    deleteButton.className = "button button--danger";
    deleteButton.type = "button";
    deleteButton.textContent = "Usuń";
    deleteButton.addEventListener("click", () => deleteEvent(event, deleteButton));

    ownerActions.append(editButton, deleteButton);
    card.append(ownerActions);
  }

  return card;
}

function renderSelectedDayEvents() {
  selectedDayTitle.textContent = `Wydarzenia: ${selectedCalendarDate.toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;

  const selectedEvents = getEventsForDate(selectedCalendarDate);
  if (!selectedEvents.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "Brak wydarzeń w tym dniu.";
    eventsList.replaceChildren(emptyState);
    return;
  }

  eventsList.replaceChildren(...selectedEvents.map(createEventCard));
}

function changeCalendarMonth(offset) {
  currentCalendarMonth = new Date(
    currentCalendarMonth.getFullYear(),
    currentCalendarMonth.getMonth() + offset,
    1,
  );
  selectedCalendarDate = new Date(
    currentCalendarMonth.getFullYear(),
    currentCalendarMonth.getMonth(),
    1,
  );
  renderCalendar();
  renderSelectedDayEvents();
}

async function loadEvents() {
  if (!currentUser) return;

  setMessage(calendarMessage, "Wczytywanie wydarzeń...");
  const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(cutoffTime);

  // Pobierz wydarzenia oraz relację zapisów dla zalogowanych użytkowników.
  const { data, error } = await supabaseClient
    .from("events")
    .select("id, title, starts_at, description, created_by, event_signups(user_id)")
    .gte("starts_at", cutoff.toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    setMessage(calendarMessage, `Nie udało się pobrać wydarzeń: ${error.message}`, "error");
    return;
  }

  const events = (data ?? []).filter((event) => new Date(event.starts_at).getTime() >= cutoffTime);
  const userIds = [...new Set(events.flatMap((event) => (event.event_signups ?? []).map((signup) => signup.user_id)))];
  if (userIds.length) {
    // Pobierz nazwy postaci zapisanych graczy; identyfikator pozostaje awaryjną etykietą.
    const { data: profiles, error: profilesError } = await supabaseClient
      .from("profiles")
      .select("user_id, character_name, character_class, role")
      .in("user_id", userIds);

    if (profilesError) {
      setMessage(calendarMessage, `Nie udało się pobrać zapisanych postaci: ${profilesError.message}`, "error");
      return;
    }

    const profilesByUserId = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
    events.forEach((event) => {
      event.event_signups = (event.event_signups ?? []).map((signup) => ({
        ...signup,
        ...(profilesByUserId.get(signup.user_id) ?? {}),
      }));
    });
  }

  calendarEvents = events;
  renderCalendar();
  renderSelectedDayEvents();
  setMessage(calendarMessage, "");
}

function startEventEdit(event) {
  if (!currentUser || event.created_by !== currentUser.id) return;

  editingEventId = event.id;
  eventForm.elements.title.value = event.title;
  eventForm.elements.starts_at.value = toLocalDateTimeInput(event.starts_at);
  eventForm.elements.description.value = event.description ?? "";
  eventSubmit.textContent = "Zapisz zmiany";
  eventCancelEdit.hidden = false;
  setMessage(eventMessage, "Edytujesz wydarzenie. Zapisz zmiany lub anuluj edycję.");
  eventForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function toLocalDateTimeInput(value) {
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function resetEventEdit() {
  editingEventId = null;
  eventForm.reset();
  eventSubmit.textContent = "Dodaj do kalendarza";
  eventCancelEdit.hidden = true;
  setMessage(eventMessage, "");
}

async function deleteEvent(event, button) {
  if (!currentUser || event.created_by !== currentUser.id) return;
  if (!window.confirm(`Usunąć wydarzenie „${event.title}”? Zapisy uczestników również zostaną usunięte.`)) return;

  button.disabled = true;
  const { data, error } = await supabaseClient
    .from("events")
    .delete()
    .eq("id", event.id)
    .eq("created_by", currentUser.id)
    .select("id")
    .maybeSingle();

  if (error) {
    button.disabled = false;
    setMessage(calendarMessage, `Nie udało się usunąć wydarzenia: ${error.message}`, "error");
    return;
  }
  if (!data) {
    button.disabled = false;
    setMessage(calendarMessage, "Nie usunięto wydarzenia: nie znaleziono go lub nie masz już do niego uprawnień.", "error");
    return;
  }

  if (editingEventId === event.id) resetEventEdit();
  setMessage(calendarMessage, "Wydarzenie zostało usunięte.", "success");
  await loadEvents();
}

async function signUpForEvent(eventId, button) {
  if (!currentUser) return;

  button.disabled = true;
  const { error } = await supabaseClient
    .from("event_signups")
    .upsert(
      { event_id: eventId, user_id: currentUser.id },
      { onConflict: "event_id,user_id", ignoreDuplicates: true },
    );

  if (error) {
    button.disabled = false;
    setMessage(calendarMessage, `Nie udało się zapisać na wydarzenie: ${error.message}`, "error");
    return;
  }

  await loadEvents();
}

function activateView(viewId) {
  document.querySelectorAll(".view").forEach((view) => {
    const isActive = view.id === viewId;
    view.classList.toggle("is-active", isActive);
    view.hidden = !isActive;
  });

  document.querySelectorAll(".nav-link[data-view]").forEach((button) => {
    const isActive = button.dataset.view === viewId;
    button.classList.toggle("is-active", isActive);
    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  if (viewId === "calendar-view") loadEvents();
  if (viewId === "info-view") loadRoster();
}

authModeToggle.addEventListener("click", () => setAuthMode(!isRegisterMode));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(authForm);
  const email = formData.get("email").trim();
  const password = formData.get("password");
  authSubmit.disabled = true;
  setMessage(authMessage, "");

  const result = isRegisterMode
    ? await supabaseClient.auth.signUp({ email, password })
    : await supabaseClient.auth.signInWithPassword({ email, password });

  authSubmit.disabled = false;

  if (result.error) {
    setMessage(authMessage, `Nie udało się ${isRegisterMode ? "utworzyć konta" : "zalogować"}: ${result.error.message}`, "error");
    return;
  }

  if (isRegisterMode && !result.data.session) {
    setMessage(authMessage, "Konto utworzone. Sprawdź pocztę i kliknij link aktywacyjny, aby potwierdzić adres e-mail.", "success");
    authForm.reset();
    return;
  }

  setMessage(authMessage, "Logowanie zakończone powodzeniem.", "success");
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  const formData = new FormData(profileForm);
  const { error } = await supabaseClient.from("profiles").upsert({
    user_id: currentUser.id,
    character_name: formData.get("character_name").trim(),
    race: formData.get("race"),
    character_class: formData.get("character_class"),
    role: formData.get("role"),
    profession: formData.get("profession").trim(),
  });

  if (error) {
    setMessage(profileMessage, `Nie udało się zapisać karty postaci: ${error.message}`, "error");
    return;
  }
  setMessage(profileMessage, "Karta postaci została zapisana.", "success");
  if (document.querySelector("#info-view").classList.contains("is-active")) loadRoster();
});

eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  const formData = new FormData(eventForm);
  const startsAt = new Date(formData.get("starts_at"));
  if (Number.isNaN(startsAt.getTime())) {
    setMessage(eventMessage, "Podaj prawidłową datę i godzinę wydarzenia.", "error");
    return;
  }

  const eventData = {
    title: formData.get("title").trim(),
    starts_at: startsAt.toISOString(),
    description: formData.get("description").trim() || null,
  };
  eventSubmit.disabled = true;
  eventCancelEdit.disabled = true;

  const result = editingEventId
    ? await supabaseClient
      .from("events")
      .update(eventData)
      .eq("id", editingEventId)
      .eq("created_by", currentUser.id)
      .select("id")
      .maybeSingle()
    : await supabaseClient
      .from("events")
      .insert({ ...eventData, created_by: currentUser.id });

  eventSubmit.disabled = false;
  eventCancelEdit.disabled = false;

  if (result.error) {
    setMessage(eventMessage, `Nie udało się ${editingEventId ? "zaktualizować" : "dodać"} wydarzenia: ${result.error.message}`, "error");
    return;
  }
  if (editingEventId && !result.data) {
    setMessage(eventMessage, "Nie zaktualizowano wydarzenia: nie znaleziono go lub nie masz już do niego uprawnień.", "error");
    return;
  }

  const wasEditing = Boolean(editingEventId);
  resetEventEdit();
  selectedCalendarDate = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate());
  currentCalendarMonth = new Date(startsAt.getFullYear(), startsAt.getMonth(), 1);
  setMessage(eventMessage, wasEditing ? "Wydarzenie zostało zaktualizowane." : "Wydarzenie dodane do kalendarza.", "success");
  await loadEvents();
});

document.querySelectorAll(".nav-link[data-view]").forEach((button) => {
  button.addEventListener("click", () => activateView(button.dataset.view));
});

document.querySelector("#refresh-roster").addEventListener("click", loadRoster);
document.querySelector("#calendar-prev").addEventListener("click", () => changeCalendarMonth(-1));
document.querySelector("#calendar-next").addEventListener("click", () => changeCalendarMonth(1));
document.querySelector("#refresh-events").addEventListener("click", loadEvents);
eventCancelEdit.addEventListener("click", resetEventEdit);
eventCancelEdit.addEventListener("click", resetEventEdit);

document.querySelector("#logout-button").addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    setMessage(document.querySelector("#app-message"), `Nie udało się wylogować: ${error.message}`, "error");
  }
});

async function initializeApp() {
  if (!window.supabase) {
    setMessage(authMessage, "Nie udało się załadować biblioteki Supabase. Odśwież stronę i spróbuj ponownie.", "error");
    authSubmit.disabled = true;
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    setMessage(authMessage, "Uzupełnij SUPABASE_URL i SUPABASE_ANON_KEY w pliku app.js, aby połączyć aplikację z projektem Supabase.", "error");
    authSubmit.disabled = true;
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    setMessage(authMessage, `Nie udało się sprawdzić sesji: ${error.message}`, "error");
    return;
  }
  setAuthenticatedView(data.session?.user);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    queueMicrotask(() => setAuthenticatedView(session?.user));
  });
}

initializeApp();

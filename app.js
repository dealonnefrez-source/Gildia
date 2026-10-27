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
const characterClassSelect = document.querySelector("#character-class");
const characterClassIcon = document.querySelector("#character-class-icon");
const CLASS_ICONS = new Map([
  ["Warrior", "icon_class/warriorhd.png"],
  ["Hunter", "icon_class/hunterhd.png"],
  ["Mage", "icon_class/magehd.png"],
  ["Warlock", "icon_class/warlockhd.png"],
  ["Shaman", "icon_class/shamanhd.png"],
  ["Priest", "icon_class/priesthd.png"],
  ["Paladin", "icon_class/paladinhd.png"],
  ["Rogue", "icon_class/roguehd.png"],
  ["Druid", "icon_class/druidhd.png"],
]);
const PROFILE_FIELDS = "imie, rasa, klasa, rola, profesja_1, poziom_profesji_1, profesja_2, poziom_profesji_2";
const rosterList = document.querySelector("#roster-list");
const rosterMessage = document.querySelector("#roster-message");
const eventForm = document.querySelector("#event-form");
const eventMessage = document.querySelector("#event-message");
const eventSubmit = document.querySelector("#event-submit");
const eventCancelEdit = document.querySelector("#event-cancel-edit");
const eventModal = document.querySelector("#event-modal");
const eventModalTitle = document.querySelector("#event-modal-title");
const eventModalClose = document.querySelector("#event-modal-close");
const eventSelectedDate = document.querySelector("#event-selected-date");
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
  if (currentUser?.id !== user?.id) {
    profileForm.reset();
    updateClassIcon();
    setMessage(profileMessage, "");
  }
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
    .select(PROFILE_FIELDS)
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    setMessage(profileMessage, `Nie udało się pobrać karty postaci: ${error.message}`, "error");
    return;
  }

  profileForm.elements.imie.value = data?.imie ?? "";
  profileForm.elements.rasa.value = data?.rasa ?? "";
  profileForm.elements.klasa.value = data?.klasa ?? "";
  profileForm.elements.rola.value = data?.rola ?? "";
  profileForm.elements.profesja_1.value = data?.profesja_1 ?? "";
  profileForm.elements.poziom_profesji_1.value = data?.poziom_profesji_1 ?? 0;
  profileForm.elements.profesja_2.value = data?.profesja_2 ?? "";
  profileForm.elements.poziom_profesji_2.value = data?.poziom_profesji_2 ?? 0;
  updateClassIcon();
  setMessage(profileMessage, "");
}

function updateClassIcon() {
  const source = CLASS_ICONS.get(characterClassSelect.value);
  characterClassIcon.hidden = !source;
  if (source) {
    characterClassIcon.src = source;
  } else {
    characterClassIcon.removeAttribute("src");
  }
}

function formatProfessions(profile) {
  return [
    [profile.profesja_1, profile.poziom_profesji_1],
    [profile.profesja_2, profile.poziom_profesji_2],
  ]
    .filter(([name]) => name?.trim())
    .map(([name, level]) => `${name} (${level ?? 0})`)
    .join(" / ");
}

function createRosterRow(profile) {
  const row = document.createElement("tr");
  row.className = "roster-row";

  [profile.imie, profile.rasa, profile.klasa, profile.rola, formatProfessions(profile)]
    .forEach((value, index) => {
      const cell = document.createElement("td");
      if (index === 0) cell.className = "roster-row__name";
      cell.textContent = value || "—";
      if (index === 2) {
        const source = CLASS_ICONS.get(profile.klasa);
        if (source) {
          const icon = document.createElement("img");
          icon.className = "class-icon";
          icon.src = source;
          icon.alt = "";
          icon.setAttribute("aria-hidden", "true");
          const classLabel = document.createElement("span");
          classLabel.className = "roster-class";
          classLabel.append(icon, document.createTextNode(value));
          cell.replaceChildren(classLabel);
        }
      }
      row.append(cell);
    });

  return row;
}

async function loadRoster() {
  if (!currentUser) return;

  setMessage(rosterMessage, "Wczytywanie członków gildii...");
  const { data, error } = await supabaseClient
    .from("profiles")
    .select(`user_id, ${PROFILE_FIELDS}`)
    .order("imie", { ascending: true });

  if (error) {
    setMessage(rosterMessage, `Nie udało się pobrać członków gildii: ${error.message}`, "error");
    return;
  }

  if (!data?.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "roster-empty";
    cell.colSpan = 5;
    cell.textContent = "Nie ma jeszcze uzupełnionych kart postaci.";
    row.append(cell);
    rosterList.replaceChildren(row);
  } else {
    rosterList.replaceChildren(...data.map(createRosterRow));
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
    const dayCell = document.createElement("div");
    dayCell.className = "calendar-day";
    dayCell.dataset.date = dateKey;
    const dayButton = document.createElement("button");
    dayButton.type = "button";
    dayButton.className = "calendar-day__select";
    dayButton.textContent = String(date.getDate());
    dayButton.setAttribute("aria-label", `${date.toLocaleDateString("pl-PL", { dateStyle: "full" })}${dayEvents.length ? `, wydarzeń: ${dayEvents.length}` : ""}`);
    dayButton.setAttribute("aria-pressed", String(dateKey === selectedKey));

    if (date.getMonth() !== month) dayCell.classList.add("calendar-day--outside");
    if (dateKey === todayKey) dayCell.classList.add("calendar-day--today");
    if (dateKey === selectedKey) dayCell.classList.add("calendar-day--selected");
    if (dayEvents.length) {
      dayCell.classList.add("calendar-day--has-events");
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
      calendarDays.querySelector(`[data-date="${dateKey}"] .calendar-day__select`).focus();
    });
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "calendar-day__add";
    addButton.textContent = "+";
    addButton.setAttribute("aria-label", `Dodaj wydarzenie: ${date.toLocaleDateString("pl-PL", { dateStyle: "full" })}`);
    addButton.addEventListener("click", () => openEventModal(date));
    dayCell.append(dayButton, addButton);
    fragment.append(dayCell);
  }

  calendarDays.replaceChildren(fragment);
}

function createEventPlayer(profile, userId) {
  const player = document.createElement("span");
  player.className = "attendee";
  const name = document.createElement("span");
  name.className = "attendee__name";
  name.textContent = profile?.imie || `Brak karty postaci (${userId})`;
  const characterClass = document.createElement("span");
  characterClass.className = "attendee__class";
  const source = CLASS_ICONS.get(profile?.klasa);
  if (source) {
    const icon = document.createElement("img");
    icon.className = "class-icon";
    icon.src = source;
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    characterClass.append(icon);
  }
  characterClass.append(document.createTextNode(profile?.klasa || "Klasa nieustawiona"));
  const role = document.createElement("span");
  role.className = "attendee__role";
  role.textContent = profile?.rola || "Rola nieustawiona";
  player.append(name, document.createTextNode(" - "), characterClass, document.createTextNode(" - "), role);
  return player;
}

function createEventCard(event) {
  const card = document.querySelector("#event-card-template").content.firstElementChild.cloneNode(true);
  card.querySelector("h4").textContent = event.title;
  const time = card.querySelector("time");
  time.dateTime = event.starts_at;
  time.textContent = new Date(event.starts_at).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const description = card.querySelector(".event-description");
  description.textContent = event.description ?? "";
  description.hidden = !event.description;
  card.querySelector(".event-organizer__profile").append(createEventPlayer(event.organizer, event.created_by));

  const attendeeList = card.querySelector(".event-attendees__list");
  const signups = event.event_signups ?? [];
  if (signups.length) {
    signups.forEach((signup) => {
      const item = document.createElement("li");
      item.append(createEventPlayer(signup.profile, signup.user_id));
      attendeeList.append(item);
    });
  } else {
    const item = document.createElement("li");
    item.textContent = "Brak zapisanych osób";
    attendeeList.append(item);
  }

  const isSignedUp = signups.some((signup) => signup.user_id === currentUser?.id);
  const signupButton = card.querySelector(".event-signup");
  signupButton.className = `button event-signup ${isSignedUp ? "button--danger" : "button--secondary"}`;
  signupButton.textContent = isSignedUp ? "Wypisz się" : "Zapisz się";
  signupButton.addEventListener("click", () => {
    if (isSignedUp) {
      leaveEvent(event.id, signupButton);
    } else {
      signUpForEvent(event.id, signupButton);
    }
  });

  if (event.created_by === currentUser?.id) {
    card.querySelector(".event-owner-actions").hidden = false;
    const editButton = card.querySelector(".event-edit");
    editButton.addEventListener("click", () => startEventEdit(event));
    const deleteButton = card.querySelector(".event-delete");
    deleteButton.addEventListener("click", () => deleteEvent(event, deleteButton));
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
  const { data, error } = await supabaseClient
    .from("events")
    .select("id, title, starts_at, description, created_by, event_signups(user_id)")
    .order("starts_at", { ascending: true });

  if (error) {
    setMessage(calendarMessage, `Nie udało się pobrać wydarzeń: ${error.message}`, "error");
    return;
  }

  const events = data ?? [];
  const userIds = [...new Set(events.flatMap((event) => [
    event.created_by,
    ...(event.event_signups ?? []).map((signup) => signup.user_id),
  ]))];
  if (userIds.length) {
    const { data: profiles, error: profilesError } = await supabaseClient
      .from("profiles")
      .select(`user_id, ${PROFILE_FIELDS}`)
      .in("user_id", userIds);

    if (profilesError) {
      setMessage(calendarMessage, `Nie udało się pobrać organizatorów i zapisanych postaci: ${profilesError.message}`, "error");
      return;
    }

    const profilesByUserId = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
    events.forEach((event) => {
      event.organizer = profilesByUserId.get(event.created_by);
      event.event_signups = (event.event_signups ?? []).map((signup) => ({
        ...signup,
        profile: profilesByUserId.get(signup.user_id),
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
  const localDateTime = toLocalDateTimeInput(event.starts_at);
  setEventDay(new Date(event.starts_at));
  eventForm.elements.event_time.value = localDateTime.slice(11, 16);
  eventForm.elements.description.value = event.description ?? "";
  eventSubmit.textContent = "Zapisz zmiany";
  eventCancelEdit.hidden = false;
  eventModalTitle.textContent = "Edytuj wydarzenie";
  setMessage(eventMessage, "Edytujesz wydarzenie. Zapisz zmiany lub anuluj edycję.");
  showEventModal();
}

function showEventModal() {
  eventModal.showModal();
  document.body.classList.add("has-event-modal");
}

function openEventModal(date) {
  if (!currentUser) return;
  resetEventEdit();
  setEventDay(date);
  eventForm.elements.event_time.value = "20:00";
  showEventModal();
}

function setEventDay(date) {
  eventForm.elements.event_day.value = getLocalDateKey(date);
  eventSelectedDate.textContent = `Dzień wydarzenia: ${date.toLocaleDateString("pl-PL", { dateStyle: "full" })}`;
}

function closeEventModal() {
  if (!eventSubmit.disabled) eventModal.close();
}

function toLocalDateTimeInput(value) {
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function resetEventEdit() {
  editingEventId = null;
  eventForm.reset();
  eventSelectedDate.textContent = "";
  eventSubmit.textContent = "Dodaj do kalendarza";
  eventCancelEdit.hidden = true;
  eventModalTitle.textContent = "Dodaj wydarzenie";
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
  button.disabled = false;
}

async function leaveEvent(eventId, button) {
  if (!currentUser) return;

  button.disabled = true;
  const { error } = await supabaseClient
    .from("event_signups")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", currentUser.id);

  if (error) {
    button.disabled = false;
    setMessage(calendarMessage, `Nie udało się wypisać z wydarzenia: ${error.message}`, "error");
    return;
  }

  await loadEvents();
  button.disabled = false;
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
  button.disabled = false;
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
  if (viewId === "members-view") loadRoster();
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

characterClassSelect.addEventListener("change", updateClassIcon);

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  const formData = new FormData(profileForm);
  const imie = formData.get("imie").trim();
  const poziomProfesji1 = Number(formData.get("poziom_profesji_1"));
  const poziomProfesji2 = Number(formData.get("poziom_profesji_2"));
  if (!profileForm.reportValidity()) return;
  if (!imie) {
    setMessage(profileMessage, "Podaj imię postaci.", "error");
    return;
  }
  if (![poziomProfesji1, poziomProfesji2].every((level) => Number.isInteger(level) && level >= 0 && level <= 600)) {
    setMessage(profileMessage, "Poziomy profesji muszą być liczbami całkowitymi od 0 do 600.", "error");
    return;
  }
  const { error } = await supabaseClient.from("profiles").upsert({
    user_id: currentUser.id,
    imie,
    rasa: formData.get("rasa"),
    klasa: formData.get("klasa"),
    rola: formData.get("rola"),
    profesja_1: formData.get("profesja_1").trim(),
    poziom_profesji_1: poziomProfesji1,
    profesja_2: formData.get("profesja_2").trim(),
    poziom_profesji_2: poziomProfesji2,
  });

  if (error) {
    setMessage(profileMessage, `Nie udało się zapisać karty postaci: ${error.message}`, "error");
    return;
  }
  setMessage(profileMessage, "Karta postaci została zapisana.", "success");
  if (document.querySelector("#members-view").classList.contains("is-active")) loadRoster();
});

eventForm.addEventListener("invalid", (event) => {
  const message = event.target === eventForm.elements.title
    ? "Podaj tytuł wydarzenia."
    : "Podaj prawidłową godzinę wydarzenia.";
  setMessage(eventMessage, message, "error");
}, true);

eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (eventSubmit.disabled) return;
  if (!currentUser) {
    setMessage(eventMessage, "Zaloguj się, aby zapisać wydarzenie.", "error");
    return;
  }

  const formData = new FormData(eventForm);
  const title = formData.get("title").trim();
  if (!title) {
    setMessage(eventMessage, "Podaj tytuł wydarzenia.", "error");
    eventForm.elements.title.focus();
    return;
  }
  const day = formData.get("event_day");
  const time = formData.get("event_time");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) {
    setMessage(eventMessage, "Wybierz dzień w kalendarzu i podaj prawidłową godzinę.", "error");
    return;
  }
  const startsAt = new Date(`${day}T${time}`);
  if (Number.isNaN(startsAt.getTime()) || toLocalDateTimeInput(startsAt) !== `${day}T${time}`) {
    setMessage(eventMessage, "Wybrana godzina nie istnieje w tym dniu. Wybierz inną godzinę.", "error");
    return;
  }

  const eventData = {
    title,
    starts_at: startsAt.toISOString(),
    description: formData.get("description").trim() || null,
  };
  eventSubmit.disabled = true;
  eventCancelEdit.disabled = true;
  eventModalClose.disabled = true;

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
  eventModalClose.disabled = false;

  if (result.error) {
    setMessage(eventMessage, `Nie udało się ${editingEventId ? "zaktualizować" : "dodać"} wydarzenia: ${result.error.message}`, "error");
    return;
  }
  if (editingEventId && !result.data) {
    setMessage(eventMessage, "Nie zaktualizowano wydarzenia: nie znaleziono go lub nie masz już do niego uprawnień.", "error");
    return;
  }

  const wasEditing = Boolean(editingEventId);
  closeEventModal();
  selectedCalendarDate = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate());
  currentCalendarMonth = new Date(startsAt.getFullYear(), startsAt.getMonth(), 1);
  await loadEvents();
  if (calendarMessage.dataset.kind !== "error") {
    setMessage(calendarMessage, wasEditing ? "Wydarzenie zostało zaktualizowane." : "Wydarzenie dodane do kalendarza.", "success");
  }
  calendarDays.querySelector(`[data-date="${getLocalDateKey(selectedCalendarDate)}"] .calendar-day__select`)?.focus();
});

document.querySelectorAll(".nav-link[data-view]").forEach((button) => {
  button.addEventListener("click", () => activateView(button.dataset.view));
});

document.querySelector("#refresh-roster").addEventListener("click", loadRoster);
document.querySelector("#calendar-prev").addEventListener("click", () => changeCalendarMonth(-1));
document.querySelector("#calendar-next").addEventListener("click", () => changeCalendarMonth(1));
document.querySelector("#refresh-events").addEventListener("click", loadEvents);
eventCancelEdit.addEventListener("click", closeEventModal);
eventModalClose.addEventListener("click", closeEventModal);
eventModal.addEventListener("click", (event) => {
  if (event.target !== eventModal) return;
  const bounds = eventModal.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
    closeEventModal();
  }
});
eventModal.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeEventModal();
});
eventModal.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeEventModal();
  }
});
eventModal.addEventListener("close", () => {
  document.body.classList.remove("has-event-modal");
  resetEventEdit();
});

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

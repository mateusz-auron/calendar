# Jak wypełnić opis wydarzenia w Kalendarzu Google

Kalendarz turniejów na stronie sklepu pobiera wydarzenia z Kalendarza Google.

Z normalnych pól wydarzenia brane są:

- **tytuł**,
- **data i godzina** (początek i koniec),
- **miejsce** (lokalizacja).

Wszystkie pozostałe informacje wpisujesz w **opisie** wydarzenia, każdą w osobnej linii, w postaci
`nazwa pola: wartość`.

## 1. Zanim zaczniesz

Kalendarz musi być **publiczny** z opcją **„Wyświetlaj wszystkie szczegóły wydarzeń”**
(Ustawienia kalendarza → Uprawnienia dostępu do wydarzeń). Przy opcji „Wyświetlaj tylko informacje
o dostępności (ukryj szczegóły)” strona nie zobaczy tytułów ani opisów.

## 2. Szablon do skopiowania

Skopiuj poniższe linie do opisu wydarzenia i uzupełnij wartości. Pole możesz zostawić puste
(np. `wyniki:`) i uzupełnić później.

```
gra: Pokemon
krótki tytuł: League Challenge
pełny tytuł: Pokémon TCG League Challenge — listopad 2026
krótki format: Standard
format: Standard · Swiss · 4 rundy
wpisowe: 20 zł
miejsca: 24
zapisy: https://example.com/zapisy
wyniki:
widoczne: tak

Tu możesz dopisać dowolny tekst, np. "Przynieś własne koszulki".
```

## 3. Pola

Każde pole ma kilka równoważnych nazw. Wielkość liter i polskie znaki nie mają znaczenia
(`Krótki tytuł`, `KROTKI TYTUL` i `krotki_tytul` działają tak samo). Spacja, `-` i `_` w nazwie też
są równoważne.

| Pole              | Nazwy                                                            | Wartość                                        | Gdzie się pokazuje                     |
| ----------------- | ---------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------- |
| **Gra**           | `gra`, `game`                                                    | Lorcana, Riftbound, One Piece, Pokemon         | logo gry, kolory, filtr gier           |
| **Krótki tytuł**  | `krótki tytuł`, `tytuł krótki`, `short_title`                    | do 40 znaków                                   | kafelek w widoku miesiąca              |
| **Pełny tytuł**   | `pełny tytuł`, `tytuł`, `full_title`, `title`                    | do 120 znaków                                  | nagłówek w oknie szczegółów            |
| **Krótki format** | `krótki format`, `short_format`                                  | do 24 znaków, np. `Standard`                   | mała etykieta na kafelku               |
| **Format**        | `format`, `pełny format`, `full_format`                          | do 80 znaków, np. `Standard · Swiss · 4 rundy` | „Format” w oknie szczegółów            |
| **Wpisowe**       | `wpisowe`, `cena`, `price`, `fee`                                | kwota albo tekst (szczegóły niżej)             | „Wpisowe” na dole okna szczegółów      |
| **Miejsca**       | `miejsca`, `liczba miejsc`, `ilość miejsc`, `seats`              | liczba od 1 do 999 albo `bez limitu`           | „Liczba miejsc” w oknie szczegółów     |
| **Zapisy**        | `zapisy`, `rejestracja`, `tournament_link`, `registration`       | link `https://…` (albo `www.…`)                | przycisk „Zapisz się na turniej”       |
| **Wyniki**        | `wyniki`, `results_link`, `results`                              | link `https://…` (albo `www.…`)                | przycisk „Zobacz wyniki” (po turnieju) |
| **Widoczne**      | `widoczne`, `widoczny`, `widoczność`, `pokaż`, `visible`, `show` | `tak` / `nie` (szczegóły niżej)                | czy wydarzenie w ogóle jest na stronie |

### Gra

Działają też dłuższe nazwy, np. „Disney Lorcana”, „Pokémon TCG”, „One Piece Card Game”, „PTCG”,
„OPTCG”.

### Wpisowe

| Wpisujesz                                        | Na stronie             |
| ------------------------------------------------ | ---------------------- |
| `20`, `20 zł`, `20zl`, `20 PLN`                  | 20 zł                  |
| `20,50` lub `20.50`                              | 20,50 zł               |
| `0`, `za darmo`, `darmowe`, `bezpłatnie`, `free` | Bezpłatnie             |
| inny tekst, np. `15 zł / 10 zł z kartą`          | tekst tak, jak wpisano |

### Miejsca

- `24` albo `24 osoby` → **24** (tekst po liczbie jest pomijany).
- `bez limitu`, `brak limitu` → **Bez limitu**.

### Zapisy i wyniki

Przycisk „Zapisz się na turniej” jest widoczny do końca turnieju (do godziny zakończenia
wydarzenia; przy wydarzeniu całodniowym do końca dnia). Po zakończeniu pojawia się „Zobacz wyniki”,
a jeśli nie ma linku do wyników, „Zobacz stronę turnieju” (prowadzi pod link z pola **Zapisy**).
Bez żadnego z tych linków przycisku nie ma.

### Widoczne

Pozwala ukryć wydarzenie na stronie, bez usuwania go z Kalendarza Google (np. szkic turnieju
albo wydarzenie wewnętrzne).

| Wpisujesz                                                     | Na stronie                 |
| ------------------------------------------------------------- | -------------------------- |
| `nie`, `false`, `no`, `0`, `off`, `ukryte`, `ukryj`, `hidden` | wydarzenie jest **ukryte** |
| `tak`, `true`, `yes`, `1`, `on`, `widoczne`, `pokaż`, `show`  | wydarzenie jest widoczne   |
| brak pola, puste pole albo inna wartość                       | wydarzenie jest widoczne   |

Ukryte wydarzenie znika ze strony całkowicie: z siatki miesiąca, z liczników, z filtrów i z
przycisków poprzednie/następne.

**Uwaga:** to ukrywa wydarzenie tylko na stronie sklepu. Kalendarz Google jest publiczny, więc
wydarzenie nadal widzi każdy, kto otworzy sam kalendarz lub jego adres iCal. Wydarzeń naprawdę
prywatnych nie dodawaj do tego kalendarza.

### Separator

Jako separatora możesz użyć `:`, `=` albo myślnika ze spacjami:

```
wpisowe: 20
wpisowe = 20
wpisowe – 20
```

## 4. Wartości domyślne

Gdy pola brakuje albo jest błędne, strona pokazuje:

| Pole          | Wartość domyślna                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| krótki tytuł  | nazwa gry, np. „Pokémon”                                                                                      |
| pełny tytuł   | tytuł wydarzenia z Kalendarza Google                                                                          |
| format        | „TBA”                                                                                                         |
| krótki format | pierwsza część formatu (np. „Standard” z „Standard · Swiss”), a gdy brak formatu: „TBA”                       |
| wpisowe       | „TBA”                                                                                                         |
| miejsca       | 12                                                                                                            |
| zapisy        | nieaktywny przycisk „Zapisy wkrótce”                                                                          |
| wyniki        | po turnieju przycisk „Zobacz stronę turnieju” (link z pola Zapisy), a bez niego brak przycisku                |
| widoczne      | wydarzenie jest widoczne                                                                                      |
| miejsce       | adres sklepu z ustawień strony (jeśli ustawiony); w przeciwnym razie miejsce i link „Wyznacz trasę” są ukryte |

## 5. Wydarzenie bez gry

Jeśli w opisie **nie ma linii `gra:`**, wydarzenie jest ogólne (np. dzień otwarty, sklep
nieczynny, premiera). Dostaje neutralne logo i pokazuje tylko tytuł, datę, godzinę, miejsce i opis.
Inne pola (np. wpisowe) pojawią się tylko wtedy, gdy je wpiszesz. **Wartości domyślne nie są
używane.**

Przykład opisu wydarzenia ogólnego:

```
Wpadnij poznać nasze gry. Kawa i herbata gratis.
```

Jeśli wpiszesz grę spoza listy (np. `gra: Magic`), wydarzenie dostanie neutralne logo i wpisaną
nazwę gry, ale wartości domyślne (TBA, 12 miejsc itd.) działają jak dla zwykłego turnieju.

## 6. Dobre praktyki

- **Jedno pole w jednej linii.** Jeśli wartość przejdzie do następnej linii, ta druga linia trafi
  do opisu, a nie do pola.
- **Wszystko, co nie jest polem, pokazuje się w sekcji „Opis”.** Np. `Uwaga: przynieś deck` to
  zwykły tekst, bo „Uwaga” nie jest nazwą pola.
- **Linia z samymi myślnikami (`---`) kończy pola.** Wszystko pod nią to zwykły opis, nawet jeśli
  wygląda jak pole.
- **Samo słowo `link` nie jest nazwą pola.** Do zapisów użyj `zapisy:`.
- **Między nazwą pola a wartością musi być separator** (`:`, `=` albo `–`). Linia
  `zapisy https://…` bez dwukropka trafi do opisu.
- **Jeśli to samo pole wpiszesz dwa razy**, liczy się pierwsza niepusta wartość.
- **Link wklejaj w całości** (`https://…`). Link wstawiony przyciskiem „Wstaw link” z własnym
  tekstem (np. „Zapisy tutaj”) też zadziała.
- **Wydarzenia cykliczne** (np. cotygodniowa liga): opis kopiuje się do każdego terminu. Żeby dodać
  link do wyników tylko jednego terminu, edytuj „tylko to wydarzenie”.
- **Turniej kończący się po północy, ale przed 6:00** (np. 18:00–01:00) pokazuje się tylko w dniu
  rozpoczęcia.

## 7. Kiedy zmiany będą widoczne

Strona zwykle pokazuje zmiany po **10–40 minutach** (jeśli używa synchronizacji iCal) albo **od razu
po odświeżeniu strony** (jeśli używa Google Calendar API). Można też wymusić synchronizację
w GitHub: **Actions → Deploy to GitHub Pages → Run workflow**.

## 8. Sprawdzanie błędów

Po każdej synchronizacji GitHub Actions wypisuje w podsumowaniu przebiegu „Deploy to GitHub Pages”
tabelę **„Opisy wydarzeń”** z problemami, np. nieznaną grą, niepoprawnym linkiem albo liczbą
miejsc, której nie da się odczytać.

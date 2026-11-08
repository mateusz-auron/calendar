# Jak dodać turniej w Kalendarzu Google

Kalendarz na stronie czyta wydarzenia z publicznego Kalendarza Google. **Data, godzina, tytuł i
miejsce** pochodzą z normalnych pól wydarzenia. Pozostałe informacje wpisujesz w **opisie**,
każdą w osobnej linii.

## Zanim zaczniesz

Kalendarz musi być udostępniony publicznie z opcją **„Wyświetlaj wszystkie szczegóły
wydarzeń”** (Ustawienia kalendarza → Uprawnienia dostępu). Przy opcji „Wyświetlaj tylko
informacje o dostępności” strona nie zobaczy tytułów ani opisów.

## Szablon do skopiowania

Wklej do opisu wydarzenia i uzupełnij. Puste pola możesz zostawić. Zostanie wtedy użyta
wartość domyślna (patrz niżej).

```
gra: Pokemon
krótki tytuł: League Challenge
pełny tytuł: Pokémon TCG League Challenge — listopad 2026
krótki format: Standard
format: Standard · Swiss · 4 rundy
wpisowe: 20
miejsca: 24
zapisy: https://...
wyniki:
widoczne: tak

Tu możesz dopisać dowolny tekst, np. „Przynieś własne koszulki”.
```

## Pola

| Pole (PL)       | Pole (EN)         | Co wpisać                                               | Gdzie się pokazuje             |
| --------------- | ----------------- | ------------------------------------------------------- | ------------------------------ |
| `gra`           | `game`            | Lorcana, Riftbound, One Piece, Pokemon                  | logo, kolor, filtr             |
| `krótki tytuł`  | `short_title`     | do 40 znaków                                            | kafelek w siatce miesiąca      |
| `pełny tytuł`   | `full_title`      | do 120 znaków                                           | okno szczegółów                |
| `krótki format` | `short_format`    | do 24 znaków, np. `Standard`                            | kafelek w siatce miesiąca      |
| `format`        | `full_format`     | np. `Standard · Swiss · 4 rundy`                        | okno szczegółów                |
| `wpisowe`       | `price`           | `20`, `20 zł`, `20,50`, `0` / `za darmo`, dowolny tekst | stopka okna („Wpisowe”)        |
| `miejsca`       | `seats`           | liczba, np. `24`, albo `bez limitu`                     | „Liczba miejsc”                |
| `zapisy`        | `tournament_link` | link do zapisów (`https://…` lub `www.…`)               | przycisk „Zapisz się”          |
| `wyniki`        | `results_link`    | link do wyników                                         | przycisk „Zobacz wyniki”       |
| `widoczne`      | `visible`         | `tak` / `nie` (też `true` / `false`, `1` / `0`)         | czy wydarzenie jest na stronie |

Wielkość liter i polskie znaki nie mają znaczenia (`Gra`, `GRA` i `gra` działają tak samo).
Zamiast `:` możesz użyć `=` albo myślnika ze spacjami (`wpisowe – 20 zł`).

## Wartości domyślne

| Gdy brakuje…     | Na stronie pojawi się                                      |
| ---------------- | ---------------------------------------------------------- |
| krótkiego tytułu | nazwa gry, np. „Pokémon”                                   |
| pełnego tytułu   | tytuł wydarzenia z Kalendarza Google                       |
| formatu          | „TBA” (krótki format bierze się z pełnego, np. `Standard`) |
| wpisowego        | „TBA”                                                      |
| liczby miejsc    | 12                                                         |
| linku do zapisów | nieaktywny przycisk „Zapisy wkrótce”                       |
| linku do wyników | po turnieju nieaktywny przycisk „Wyniki wkrótce”           |
| pola `widoczne`  | wydarzenie jest widoczne                                   |
| miejsca          | adres sklepu z ustawień strony                             |

## Ukrywanie wydarzenia

`widoczne: nie` ukrywa wydarzenie na stronie (siatka, liczniki, filtry, poprzednie/następne), bez
usuwania go z Kalendarza Google. Kalendarz jest jednak publiczny, więc wydarzenie nadal widać w
samym Kalendarzu Google i w jego adresie iCal.

## Wydarzenie bez gry

Jeśli w opisie **nie ma linii `gra:`**, wydarzenie jest ogólne (np. dzień otwarty, sklep
nieczynny). Ma neutralne logo i pokazuje tylko tytuł, datę, miejsce i opis. Inne pola
(np. `wpisowe`) pojawią się tylko wtedy, gdy je wpiszesz. Wartości domyślne nie są używane.

Jeśli wpiszesz grę spoza listy (np. `gra: Magic`), wydarzenie dostanie neutralne logo, ale
pozostałe zasady (TBA, 12 miejsc) działają jak dla turnieju.

## Dobre praktyki

- **Jedno pole w jednej linii.** Jeśli tekst pola przejdzie do następnej linii, ta druga linia
  trafi do opisu.
- **Link wklejaj w całości** (`https://…`). Link wstawiony przyciskiem „Wstaw link” z własnym
  tekstem też zadziała.
- Linia z samymi myślnikami (`---`) kończy pola. Wszystko pod nią to zwykły opis.
- **Wydarzenia cykliczne:** opis kopiuje się do każdego terminu. Żeby dodać wyniki tylko do
  jednego terminu, edytuj „tylko to wydarzenie”.
- Turniej, który kończy się po północy, ale przed 6:00 (np. 18:00–01:00), pokazuje się tylko
  w dniu rozpoczęcia.

## Sprawdzanie błędów

Po każdej synchronizacji (co ok. 10 minut) GitHub Actions wypisuje w podsumowaniu przebiegu
„Deploy to GitHub Pages” tabelę **„Opisy wydarzeń”** z problemami, np. nieznaną grą,
niepoprawnym linkiem albo liczbą miejsc, której nie da się odczytać.

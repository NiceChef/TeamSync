# Karta funkcjonalności systemu TeamSync
| Moduł | Funkcjonalność | Opis funkcjonalności | Uwagi |
| --- | --- | --- | --- |
| Rejestracja i logowanie użytkowników | Rejestracja konta użytkownika | Umożliwia utworzenie konta pracownika lub klienta na podstawie formularza rejestracyjnego. System zapisuje dane użytkownika i nadaje odpowiedni typ konta odnosząc się do podanego e-maila w rejestracji. | Wymaga walidacji formularza i obsługi ról |
| Rejestracja i logowanie użytkowników | Logowanie do systemu | Użytkownik podaje login i hasło, a system sprawdza poprawność danych i przyznaje dostęp do aplikacji. | Wymaga autoryzacji i sesji / tokenów |
| Rejestracja i logowanie użytkowników | Zarządzanie danymi logowania | Umożliwia zmianę hasła, aktualizację danych logowania i podstawową kontrolę bezpieczeństwa konta. |  |
| Rejestracja i logowanie użytkowników | Resetowanie hasła | Pozwala użytkownikowi odzyskać dostęp do konta przez mechanizm resetowania hasła, np. przez e-mail. | Integracja z wysyłką wiadomości |
| Zarządzanie profilem użytkownika | Edycja danych użytkownika | Użytkownik może zaktualizować swoje podstawowe dane profilowe, np. imię, nazwisko lub dane kontaktowe. | Prosta funkcjonalność formularzowa |
| Zarządzanie profilem użytkownika | Przypisanie użytkownika do grup | Administrator lub uprawniony użytkownik może przypisać użytkownika do działu lub grupy projektowej. | Powiązanie z rolami i uprawnieniami |
| Zarządzanie profilem użytkownika | Lista projektów i zadań użytkownika | Użytkownik może zobaczyć zadania, projekty i grupy, do których został przypisany. | Wymaga filtrowania danych po użytkowniku |
| Zarządzanie grupami i zespołami | Tworzenie nowych grup | Umożliwia zakładanie nowych grup lub zespołów projektowych w systemie. | Formularz + zapis do bazy |
| Zarządzanie grupami i zespołami | Przypisywanie użytkowników do grup | Pozwala dodać użytkownika do wybranej grupy lub przenieść go do innej. | Wymaga kontroli dostępu. Trzeba uważać, żeby klient z innej firmy nie widział co się dzieje w innych firmach |
| Zarządzanie grupami i zespołami | Wyszukiwanie grup | Umożliwia szybkie odnalezienie grup po nazwie, dziale lub projekcie. | Wyszukiwarka / filtry |
| Zarządzanie grupami i zespołami | Przegląd członków zespołu | Pokazuje listę członków przypisanych do danej grupy wraz z podstawowymi informacjami. | Widok listy członków |
| Zarządzanie zadaniami i podzadaniami | Tworzenie zadań | Umożliwia dodawanie nowych zadań z nazwą, opisem, terminem i statusem. | Jedna z głównych funkcji systemu |
| Zarządzanie zadaniami i podzadaniami | Tworzenie podzadań | Pozwala rozbić zadanie główne na mniejsze elementy do wykonania. | Wymaga relacji zadanie-podzadanie. Jeżeli to będzie zbyt czasochłonne porzucimy temat |
| Zarządzanie zadaniami i podzadaniami | Przypisywanie zadań do użytkowników lub grup | System umożliwia przypisanie zadania konkretnej osobie, klientowi lub całej grupie. | Powiązanie z użytkownikami i grupami |
| Zarządzanie zadaniami i podzadaniami | Zapisywanie zadań w bazie danych | Odpowiada za utrwalanie danych o zadaniach i ich aktualizację w bazie | Backend + model danych |
| Zarządzanie zadaniami i podzadaniami | Wyszukiwanie zadań i podzadań | Umożliwia filtrowanie i odnajdywanie zadań według nazwy, statusu, użytkownika lub terminu. | Wyszukiwarka + filtry |
| Planowanie pracy i zarządzanie czasem | Widok kalendarza miesięcznego i tygodniowego | System wyświetla zadania w formie kalendarza, co ułatwia planowanie terminów. | Jedna z bardziej czasochłonnych funkcji. W razie problemów możemy zrobić tylko miesięczny (tablica z 28,30,31 dniami w zależności od miesiąca) |
| Planowanie pracy i zarządzanie czasem | Ustalanie terminów realizacji zadań | Użytkownik może przypisać do zadania datę rozpoczęcia, deadline i ewentualne przypomnienia. | Powiązane z kalendarzem |
| Planowanie pracy i zarządzanie czasem | Określanie priorytetów zadań | Zadaniom można nadać priorytet, np. niski, średni, wysoki. | Mała funkcjonalność |
| Planowanie pracy i zarządzanie czasem | Zmiana statusu zadania | Umożliwia oznaczanie zadań jako np. „do wykonania”, „w trakcie”, „zakończone”. | Prosta, ale ważna funkcja. Pamiętajmy, że wszystkie drobne listy mają być w bazie. Tak jak w tym przypadku tabela w bazie statusy, itd. |
| Zarządzanie klientami | Wyszukiwanie klientów | Umożliwia szybkie odnajdywanie klientów po nazwie, adresie e-mail lub przypisaniu do organizacji. | Wyszukiwarka danych |
| Zarządzanie klientami | Przypisywanie zadań do klientów | Pozwala przypisać wybrane zadanie klientowi lub udostępnić mu jego część. | Wymaga kontroli dostępu |
| Zarządzanie klientami | Dostęp klientów do swoich zadań i dokumentów | Klient ma wgląd wyłącznie do przypisanych mu danych, plików i harmonogramów. | Kluczowe dla bezpieczeństwa |
| Zarządzanie plikami i dokumentacją | Przesyłanie plików do systemu | Użytkownik może dodawać pliki do aplikacji, np. dokumenty, obrazy lub załączniki projektowe. | Upload + walidacja rozmiaru i formatu. Tutaj musimy uważać, żeby sobie nie strzelić w kolano i żeby nam to nie pochłonęło zbyt dużo czasu. |
| Zarządzanie plikami i dokumentacją | Powiązanie plików z zadaniami | System umożliwia przypisanie przesłanych plików do konkretnego zadania lub projektu. | Relacja plik-zadanie |
| Zarządzanie plikami i dokumentacją | Dostęp do plików dla członków zespołu i klientów | Pliki są udostępniane zgodnie z uprawnieniami użytkownika. | Ważna kontrola ról i widoczności |
| Komentarze i komunikacja przy zadaniach | Dodawanie komentarzy do zadań | Użytkownicy mogą prowadzić dyskusję bezpośrednio pod zadaniem. | Komunikacja kontekstowa |
| Komentarze i komunikacja przy zadaniach | Historia aktywności przy zadaniu | System zapisuje informacje o zmianach, komentarzach i aktualizacjach zadania. | Wymaga logowania aktywności. Created at, Updated At,… tak żeby każdy widział jak ktoś edytuje ten sam plik. Kiedy jest edytowane zadanie przez 2 osoby i ktoś szybciej zmieni to wywala drugiego użytkownika z informacją, że ktoś przed nim już zdążył zmienić zapis. |
| Komentarze i komunikacja przy zadaniach | Powiadomienia o zmianach i komentarzach | Użytkownicy otrzymują informację o nowych komentarzach lub zmianie statusu zadania. | Można zrobić jako wersję podstawową lub rozszerzoną |
| Wyszukiwanie danych | Wyszukiwanie zadań i podzadań | Pozwala odnaleźć zadania po nazwie, terminie, statusie lub przypisaniu. | Częściowo pokrywa się z modułem zadań |
| Wyszukiwanie danych | Wyszukiwanie użytkowników i klientów | Ułatwia wyszukiwanie osób w systemie. | Potrzebne przy przypisywaniu |
| Wyszukiwanie danych | Wyszukiwanie grup projektowych | Pozwala wyszukiwać zespoły i grupy według nazwy lub struktury organizacyjnej. | Prostsza funkcjonalność |
| Generowanie raportów | Raporty z realizacji zadań | System tworzy zestawienia pokazujące poziom wykonania zadań. | Wymaga agregacji danych. Prosty szablon. Mogą być nawet surowe dane w postaci raw text? |
| Generowanie raportów | Przegląd postępów projektów | Pozwala śledzić etap realizacji projektu na podstawie zadań i terminów. | Widok analityczny. Jak wyżej raw text? |
| Generowanie raportów | Zestawienia aktywności użytkowników | System generuje informacje o aktywności użytkowników, np. liczbie wykonanych zadań lub komentarzy. | Raport administracyjny. Jak wyżej. |
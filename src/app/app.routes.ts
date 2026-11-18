import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/library/library.page').then((m) => m.LibraryPage),
  },
  {
    path: 'book/:bookId/new',
    loadComponent: () => import('./features/new-game/new-game.page').then((m) => m.NewGamePage),
  },
  {
    path: 'book/:bookId/play',
    loadComponent: () => import('./features/reader/reader.page').then((m) => m.ReaderPage),
  },
  {
    path: 'book/:bookId/chart',
    loadComponent: () =>
      import('./features/action-chart/action-chart.page').then((m) => m.ActionChartPage),
  },
  {
    path: 'book/:bookId/page/:pageId',
    loadComponent: () => import('./features/page/book-page.page').then((m) => m.BookPagePage),
  },
  {
    path: 'book/:bookId/transfer',
    loadComponent: () => import('./features/transfer/transfer.page').then((m) => m.TransferPage),
  },
  {
    path: 'import',
    loadComponent: () => import('./features/transfer/import.page').then((m) => m.ImportPage),
  },
  {
    path: 'transfer/:payload',
    loadComponent: () => import('./features/transfer/import.page').then((m) => m.ImportPage),
  },
  {
    path: 'send/:code',
    loadComponent: () => import('./features/transfer/send.page').then((m) => m.SendPage),
  },
  { path: '**', redirectTo: '' },
];

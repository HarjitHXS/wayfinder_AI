import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LandingPageComponent } from './components/landing-page/landing-page.component';
import { HomeComponent } from './components/home/home.component';
import { TaskHistoryComponent } from './components/task-history/task-history.component';

const routes: Routes = [
  { path: '', component: LandingPageComponent },
  { path: 'app', component: HomeComponent },
  { path: 'history', component: TaskHistoryComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { GamescreenComponent } from './gamescreen/gamescreen.component';
import { TeamService } from './team.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, GamescreenComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'quidditch-manager';

  constructor(private teamService: TeamService) {}

  uploadTeams() {
    this.teamService.uploadTeams();
  }
}
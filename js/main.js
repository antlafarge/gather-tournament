import {HomePageController} from './homePageController.js'
import {TournamentController} from './tournamentController.js'

angular
.module("MTG", ["ngRoute"])
.config(["$routeProvider", function($routeProvider) {
	$routeProvider
	.when("/", {
		templateUrl: "html/homePage.html",
		controller: "HomePageCtrl"
	})
	.when("/settings", {
		templateUrl: "html/settings.html",
		controller: "HomePageCtrl"
	})
	.when("/tournament", {
		templateUrl: "html/tournament.html",
		controller: "TournamentCtrl"
	})
	.otherwise({
		templateUrl: "html/404.html"
	});
}])
.controller("HomePageCtrl", ["$scope", HomePageController])
.controller("TournamentCtrl", ["$scope", TournamentController]);

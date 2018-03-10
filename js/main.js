import {HomePageController} from './homePageController.js'
import {SwissTournamentController} from './swissTournamentController.js'

var app = angular.module("GatherTournamentApp", ["ngRoute"]);

app.directive('customOnChange', function() {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      var onChangeHandler = scope.$eval(attrs.customOnChange);
      element.on('change', onChangeHandler);
      element.on('$destroy', function() {
        element.off();
      });

    }
  };
});

app.config(["$routeProvider", function($routeProvider) {
	$routeProvider
	.when("/", {
		templateUrl: "html/homePage.html",
		controller: "HomePageCtrl",
		caseInsensitiveMatch: false
	})
	.when("/settings", {
		templateUrl: "html/settings.html",
		controller: "HomePageCtrl",
		caseInsensitiveMatch: false
	})
	.when("/swiss/:import?", {
		templateUrl: "html/swissTournament.html",
		controller: "SwissTournamentCtrl",
		caseInsensitiveMatch: false
	})
	.otherwise({
		templateUrl: "html/404.html",
		caseInsensitiveMatch: false
	});
}]);

app.controller("HomePageCtrl", ["$scope", HomePageController]);

app.controller("SwissTournamentCtrl", ["$scope", "$route", "$routeParams", "$q", SwissTournamentController]);

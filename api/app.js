const { App } = require("@slack/bolt");
const addQuotes = require('./quotes.js');
const schedule = require('node-schedule');
const moment = require('moment');
const Airtable = require('airtable');
require('dotenv').config();

Airtable.configure({
	endpointUrl: 'https://api.airtable.com',
	apiKey: process.env.AIRTABLE_API_KEY
});
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

const token = process.env.SLACK_BOT_TOKEN;
const channel = process.env.SLACK_MILLION_CHANNEL;
const port = process.env.PORT ?? 3000;

const goalDate = '3/1/2024';
const goalNumber = 300000;

const app = new App({
	token: token,
	signingSecret: process.env.SLACK_SIGNING_SECRET
});

function extractNumber(txt) {
	let array = ["\n", " ", "-"]
	for (let i of array) {
		if (txt.includes(i)) {
			return txt.split(i)[0]
		}
	}
	return txt;
}

async function fetchLatest(id) {
	try {
		const result = await app.client.conversations.history({
			token: token,
			channel: id,
			limit: 100,
		});
		let number;
		for (let x = 0; x < result.messages.length; x++) {
			number = extractNumber(
				result.messages[x].text,
			);

			if (!isNaN(number)) break;
		}
		return number;
	} catch (error) {
		console.error(error);
	}
}

async function fetchOldest(id) {
	try {
		const result = await app.client.conversations.history({
			token: token,
			channel: id,
			oldest: Math.floor(Date.now() / 1000) - 86400, //debug: 1609295166, actual: Math.floor(Date.now() / 1000) - 86400
			inclusive: false,
		});
		let number;
		for (let x = result.messages.length - 2; x >= 0; x--) {
			number = extractNumber(
				result.messages[x].text,
			);

			if (!isNaN(number)) break;
		}
		return number - 1;
	} catch (error) {
		console.error(error);
	}
}

async function publishMessage(id, text) {
	try {
		await app.client.chat.postMessage({
			token: token,
			channel: id,
			text: text
		});
	} catch (error) {
		console.error(error);
	}
}

async function postReaction(id, emoji, ts) {
	try {
		await app.client.reactions.add({
			token: token,
			channel: id,
			name: emoji,
			timestamp: ts
		});
	} catch (error) {
		console.error(error)
	}
}

async function pinMessage(id, ts) {
	try {
		await app.client.pins.add({
			token: token,
			channel: id,
			timestamp: ts
		})
	} catch (error) {
		console.error(error)
	}
}

async function addData(db, object) {
	base(db).create(object, function(err, record) {
		if (err) {
			console.error(err);
			return;
		}
	})
}

async function getAverage() {
	try {
		const obj = await base('increase')
			.select({
				maxRecords: 30,
				sort: [{ field: 'Date', direction: 'desc' }]
			})
			.firstPage();

		let sum = 0;
		obj.forEach((item) => (sum += item.fields.increase));

		return sum / obj.length;
	} catch (error) {
		console.error(error);
	}
}

async function report() {
	console.log("Writing daily report...");
	let oldest = await fetchOldest(channel);
	let latest = await fetchLatest(channel);
	let diff = latest - oldest;
	addData('increase', {
		"Date": moment().subtract(1, "days").format("YYYY-MM-DD"),
		"increase": diff,
		"start": oldest,
	})
	let averageSpeed = await getAverage();
	let pastThousandsGoal = Math.floor(latest / 1000) * 1000;
	let goals = predictSpeed(goalDate, goalNumber, latest);
	let message =
		`Today we've went from *${oldest}* to *${latest}*!
		- :arrow_upper_right: The day's progress: *+${diff}*
		- :chart_with_upwards_trend: Average daily speed: *${Math.round(averageSpeed)}*
		- :round_pushpin: Our current goal is to reach *${goalNumber}* by *${moment(goalDate).format('MMMM D')}.*
		- :calendar: If we want to get there on time, we need to count by at least *+${Math.ceil(goals[1])}* a day.
		- :1234: Here's a number to aim for today: *${Math.ceil(parseInt(latest) + parseInt(goals[1]))}*`;
	if (pastThousandsGoal > oldest && pastThousandsGoal <= latest) {
		let messageWithCelebration = `:tada: Congratulations! We've went past ${pastThousandsGoal}! :tada: \n` + message;
		publishMessage(channel, addQuotes(messageWithCelebration, goals, averageSpeed));
	} else {
		publishMessage(channel, addQuotes(message, goals, averageSpeed));
	}

	console.log("Sent daily report.");
};

function predictSpeed(goalDate, goalNumber, currentNumber) {
	let today = new Date();
	let goal = new Date(goalDate);
	let timeRemaining = Math.abs(goal - today);
	let daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));
	let neededSpeed = (goalNumber - currentNumber) / daysRemaining;
	return [daysRemaining, neededSpeed];

}

app.event('message', async (body) => {
	try {
		let e = body.event;
		if (typeof e.subtype === "undefined" && /\d/.test(e.text[0])) {
			let number = extractNumber(e.text);
			let ts = e.ts;
			let c = e.channel;
			if (number % 1000 === 0) {
				postReaction(c, "tada", ts);
			}
			if (number % 5000 === 0) {
				pinMessage(c, ts);
			}
			if (number.slice(-2) === '69') {
				postReaction(c, "ok_hand", ts);
			}
			if (number.slice(-3) === '666') {
				postReaction(c, "smiling_imp", ts)
			} if (number.slice(-3) === number.slice(0, 3).split("").reverse().join("")) {
				postReaction(c, "tacocat", ts)
			}
		}
	} catch (err) {
		console.error(err);
	}
});

app.event('app_mention', async (body) => {
	try {
		let e = body.event;
		let c = e.channel;
		let choose = Math.floor(Math.random() * 8);
		let messageArray = [
			"DO NOT BOTHER ME. I AM SLEEPING.",
			"AAAAAAAA!!! THE SUN! *pulls curtains closed* I nearly got _burnt_ that time, you pathetic little minions! Next time, DO NOT WAKE ME.",
			"What do you want, human weakling?",
			"Hrmh? Is Count von Corgo pissing on the lawn _again_?",
			"What is it? Are you going too slow that you need another supernatural being to help you _speed-count_? If so, you've found the wrong one, because this supernatural being is _trying to sleep!_",
			"HISSSSSSSSSSS!",
			"Minions, I had _three hours_ of sleep yesterday, and I am trying to catch up. Please, _leave me alone to sleep._",
		];
		
		publishMessage(c, messageArray[choose]);

		console.log("App mentioned.");
	} catch (err) {
		console.error(err)
	}
});

(async () => {
	try {
		await app.start(port);
		schedule.scheduleJob('0 0 * * *', report);
		console.log(`Started bot, listening on port ${port}`)
	} catch (error) {
		console.error(error);
	}
})();

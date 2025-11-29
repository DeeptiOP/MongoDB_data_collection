require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const DB_NAME = 'zenclass';
const SAMPLE_DIR = path.join(__dirname, 'sample-data');

function loadJson(filename) {
	const p = path.join(SAMPLE_DIR, filename);
	const raw = fs.readFileSync(p, 'utf8');
	return JSON.parse(raw);
}

function toISODate(value) {
	if (!value) return null;
	// If already a Date
	if (value instanceof Date) return value;
	// Try to parse string YYYY-MM-DD or variations
	const d = new Date(value);
	if (!isNaN(d.getTime())) return d;
	return null;
}

async function main() {
	// Allow MongoDB URI via environment variable or first CLI arg, fall back to local
	const uriFromEnv = process.env.MONGODB_URI || process.env.MONGO_URI;
	const uriFromArg = process.argv[2];
	const uri = uriFromEnv || uriFromArg || 'mongodb://127.0.0.1:27017';

	const client = new MongoClient(uri);
	await client.connect();
	const shown = (uri.startsWith('mongodb+srv://')) ? 'mongodb+srv://<atlas-cluster>' : uri;
	console.log('Connected to MongoDB at', shown);

	const db = client.db(DB_NAME);

	// Collections to load
	const files = ['users.json','codekata.json','attendance.json','topics.json','tasks.json','company_drives.json','mentors.json'];

	// Clear existing collections (if any) and insert sample data with date conversions
	for (const file of files) {
		const name = path.basename(file, '.json');
		const col = db.collection(name);
		try { await col.drop(); } catch (e) { /* ignore if doesn't exist */ }
		const docs = loadJson(file);

		// Convert date-like fields to ISODate where applicable
		const prepared = docs.map(doc => {
			const copy = Object.assign({}, doc);
			if (copy.date) copy.dateISO = toISODate(copy.date);
			if (copy.drive_date) copy.drive_dateISO = toISODate(copy.drive_date);
			// keep numeric ids as-is
			return copy;
		});

		if (prepared.length) await col.insertMany(prepared);
		console.log(`Inserted ${prepared.length} into ${name}`);
	}

	// Helper date range
	const startRange = new Date('2020-10-15T00:00:00Z');
	const endRange = new Date('2020-10-31T23:59:59Z');

	// 1) Topics and Tasks taught in October 2020
	console.log('\n1) Topics in October 2020:');
	const topicsOct = await db.collection('topics').find({ dateISO: { $gte: new Date('2020-10-01T00:00:00Z'), $lt: new Date('2020-11-01T00:00:00Z') } }).toArray();
	console.table(topicsOct.map(t => ({ _id: t._id, topic: t.topic, date: t.date })) );

	console.log('\nTasks in October 2020:');
	const tasksOct = await db.collection('tasks').find({ dateISO: { $gte: new Date('2020-10-01T00:00:00Z'), $lt: new Date('2020-11-01T00:00:00Z') } }).toArray();
	console.table(tasksOct.map(t => ({ _id: t._id, task_name: t.task_name, date: t.date, user_id: t.user_id })) );

	console.log('\nTopics with their tasks (October topics):');
	const topicsWithTasks = await db.collection('topics').aggregate([
		{ $match: { dateISO: { $gte: new Date('2020-10-01T00:00:00Z'), $lt: new Date('2020-11-01T00:00:00Z') } } },
		{ $lookup: { from: 'tasks', localField: '_id', foreignField: 'topic_id', as: 'tasks' } },
		{ $project: { topic:1, date:1, tasks: { _id:1, task_name:1, user_id:1, submitted:1, date:1 } } }
	]).toArray();
	for (const t of topicsWithTasks) {
		console.log(`- ${t.topic} (${t.date}) -> ${t.tasks.length} tasks`);
	}

	// 2) Company drives between 15-10-2020 and 31-10-2020
	console.log('\n2) Company drives between 2020-10-15 and 2020-10-31:');
	const drives = await db.collection('company_drives').find({ drive_dateISO: { $gte: startRange, $lte: endRange } }).toArray();
	console.table(drives.map(d => ({ company: d.company, drive_date: d.drive_date })) );

	// 3) Company drives and students who appeared (with user names)
	console.log('\n3) Company drives with students (resolved names):');
	const drivesWithStudents = await db.collection('company_drives').aggregate([
		{ $match: { drive_dateISO: { $gte: startRange, $lte: endRange } } },
		{ $lookup: { from: 'users', localField: 'students_attended', foreignField: '_id', as: 'students' } },
		{ $project: { company:1, drive_date:1, 'students._id':1, 'students.name':1, 'students.email':1 } }
	]).toArray();
	for (const d of drivesWithStudents) {
		console.log(`- ${d.company} (${d.drive_date}): ${d.students.map(s => s.name).join(', ')}`);
	}

	// 4) Number of problems solved by user in codekata (per user) and total
	console.log('\n4) Problems solved per user and total:');
	const solvedPerUser = await db.collection('codekata').aggregate([
		{ $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
		{ $unwind: '$user' },
		{ $project: { _id:0, user_id:1, user: '$user.name', problems_solved:1 } }
	]).toArray();
	console.table(solvedPerUser.map(s => ({ user: s.user, problems_solved: s.problems_solved }))); 
	const totalSolved = await db.collection('codekata').aggregate([{ $group: { _id: null, total: { $sum: '$problems_solved' } } }]).toArray();
	console.log('Total problems solved:', (totalSolved[0] && totalSolved[0].total) || 0);

	// 5) Mentors who have mentee count more than 15
	console.log('\n5) Mentors with mentee count > 15:');
	const bigMentors = await db.collection('mentors').aggregate([
		{ $project: { mentor_name:1, menteeCount: { $size: { $ifNull: ['$mentees', []] } } } },
		{ $match: { menteeCount: { $gt: 15 } } }
	]).toArray();
	if (bigMentors.length === 0) console.log('No mentors with more than 15 mentees found.');
	else console.table(bigMentors.map(m => ({ mentor: m.mentor_name, menteeCount: m.menteeCount }))); 

	// 6) Number of users who are absent AND task not submitted between 15-10-2020 and 31-10-2020
	console.log('\n6) Count of users absent and who did not submit tasks in the date range:');
	const absentUsers = await db.collection('attendance').distinct('user_id', { status: 'absent', dateISO: { $gte: startRange, $lte: endRange } });
	const usersWhoDidNotSubmit = await db.collection('tasks').distinct('user_id', { user_id: { $in: absentUsers }, submitted: false, dateISO: { $gte: startRange, $lte: endRange } });
	console.log('Absent users in range:', absentUsers.length);
	console.log('Absent users who also did not submit tasks:', usersWhoDidNotSubmit.length);

	await client.close();
	console.log('\nFinished. MongoDB connection closed.');
}

main().catch(err => {
	console.error('Error running queries:', err);
	process.exit(1);
});
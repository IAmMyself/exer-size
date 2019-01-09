const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const path = require('path')
const mongo = require('mongodb')
const url = process.env.MONGOLAB_URI
const cors = require('cors')

app.use(cors())

app.use(bodyParser.urlencoded({
    extended: false
}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html')
});

app.get("/api/exercise/log", function(req, res) {
    var username = req.query.username,
        from = req.query.from,
        to = req.query.to,
        limit = req.query.limit,
        temp = [];

    if (username == undefined) {
        res.send({
            success: false,
            error: "Username not specified"
        });
        res.end();
        return;
    }

    mongo.connect(url, function(err, db) {
        if (err != undefined) {
            throw err;
        }
        db.collection("users").find({
            "_id": username
        }).toArray(function(err, data) {
            if (err != undefined) {
                throw err;
            }
            if (data[0] == undefined) {
                res.send({
                    success: false,
                    error: "Username not found in database."
                });
            } else {

                if (from != undefined) {
                    from = from.split("-");
                    if (isNaN(from[0]) || isNaN(from[1]) || isNaN(from[2])) {
                        res.send({
                            success: false,
                            error: "From should be yyyy-mm-dd"
                        });
                        res.end();
                        return;
                    }
                    for (var i = 0; i < data[0].exercises.length; i++) {
                        var date = data[0].exercises[i].date.split("-");
                        if (date[0] > from[0] || (date[0] == from[0] && date[1] > from[1] || (date[0] == from[0] && date[1] == from[1] && date[2] >= from[2]))) {
                            temp.push(data[0].exercises[i]);
                        }
                    }
                    data[0].exercises = temp;
                }

                if (to != undefined) {
                    temp = [];
                    to = to.split("-");

                    if (isNaN(to[0]) || isNaN(to[1]) || isNaN(to[2])) {
                        res.send({
                            success: false,
                            error: "To should be yyyy-mm-dd"
                        });
                        res.end();
                        return;
                    }

                    for (var i = 0; i < data[0].exercises.length; i++) {
                        var date = data[0].exercises[i].date.split("-");
                        if (date[0] < to[0] || (date[0] == to[0] && date[1] < to[1] || (date[0] == to[0] && date[1] == to[1] && date[2] <= to[2]))) {
                            temp.push(data[0].exercises[i]);
                        }
                    }
                    data[0].exercises = temp;
                }

                if (limit != undefined) {
                    if (isNaN(limit)) {
                        res.send({
                            success: false,
                            error: "limit should be number"
                        });
                        res.end();
                        return;
                    }
                    data[0].exercises = data[0].exercises.slice(0, limit);
                }
                res.send(data[0]);
            }
            res.end();
            return;
        })
    });
});

app.post("/api/exercise/new-user", function(req, res) {
    var username = req.body.username;

    if (username != undefined) {
        mongo.connect(url, function(err, db) {
            if (err != undefined) {
                throw err;
            }

            function insert() {
                db.collection("users").insertOne({
                    "_id": username,
                    "exercises": []
                })
                res.send({
                    "_id": username,
                    "exercises": []
                });
                res.end()
            }

            db.collection("users").find({
                "_id": username
            }).toArray(function(err, data) {
                if (err != undefined) {
                    throw err;
                }
                if (data[0] != undefined) {
                    res.send({
                        success: false,
                        error: "Username already exists."
                    })
                } else {
                    insert();
                }
            })
        })
    } else {
        res.send({
            success: false,
            error: "Username not defined."
        });
        res.end();
        return;
    }
});

app.post("/api/exercise/add", function(req, res) {
    var username = req.body.username,
        description = req.body.description,
        duration = req.body.duration,
        date = req.body.date.split("-");
  console.log(username == '');

    if (username == '') {
        res.send({
            success: false,
            error: "Username not defined."
        });
        res.end();
        return;
    } else if (description == '') {
        res.send({
            success: false,
            error: "Description not defined."
        });
        res.end();
        return;
    } else if (duration == '') {
        res.send({
            success: false,
            error: "Duration not defined."
        });
        res.end();
        return;
    } else if (isNaN(date[0]) || isNaN(date[1]) || isNaN(date[2])) {
      date = undefined;
    }

    mongo.connect(url, function(err, db) {
        if (err != undefined) {
            throw err;
        }

        function addExercise(exercises) {
            db.collection("users").update({
                "_id": username
            }, {
                $set: {
                    exercises
                }
            }, function(err, status) {

                if (err != undefined) {

                    console.log(err.message);

                    res.send({
                        success: false,
                        error: "Apologies, something went wrong when we were adding your exercise."
                    });

                    res.end();
                    return;

                } else {

                    res.send({
                        success: true
                    });

                    res.end();
                    return;

                }

            });

        }

        db.collection("users").find({
            "_id": username
        }).toArray(function(err, data) {
            if (err != undefined) {
                throw err;
            }
            if (data[0] != undefined) {
                var exercises = data[0].exercises;
                exercises.push({
                    description: description,
                    duration: duration
                });
                if (date != undefined) {
                  exercises[exercises.length - 1].date = date;
                }
                addExercise(exercises);
            } else {
                res.send({
                    success: false,
                    error: "Username not found."
                });
                res.end();
                return;
            }
        })
    })
});

//Not Found middleware
app.use((req, res, next) => {
    return next({
        status: 404,
        message: 'not found'
    })
})

// Error Handling middleware
app.use((err, req, res, next) => {
    let errCode, errMessage

    if (err.errors) {
        // mongoose validation error
        errCode = 400 // bad request
        const keys = Object.keys(err.errors)
        // report the first validation error
        errMessage = err.errors[keys[0]].message
    } else {
        // generic or custom error
        errCode = err.status || 500
        errMessage = err.message || 'Internal Server Error'
    }
    res.status(errCode).type('txt')
        .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port)
})
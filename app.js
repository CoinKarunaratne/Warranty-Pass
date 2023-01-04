require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const moment = require("moment");
const mongoose = require('mongoose');
const multer = require("multer");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require("mongoose-findorcreate");
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();

app.set('view engine', 'ejs');
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended : true}));
app.use(session({
  secret : process.env.SESSION_SECRET,
  resave : false,
  saveUninitialized : false
}))
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb+srv://" + process.env.DB_PASSWORD)

const warrantySchema = new mongoose.Schema ({
  Name: String,
  Store : String,
  Start_Date : String,
  End_Date : String,
  Period : String,
  Img_URL : String
})

const userSchema = new mongoose.Schema ({
  username : String,
  password : String,
  googleId :String,
  Items : [warrantySchema]
})

userSchema.plugin(passportLocalMongoose)
userSchema.plugin(findOrCreate)

const Item = mongoose.model('warranty', warrantySchema)
const User = mongoose.model("user", userSchema)

passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, {
      id: user.id,
      username: user.username,
      picture: user.picture
    });
  });
});

passport.deserializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/product"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

var dateRemain = "";
var percentage = 0;
var imgURL = ""
var imgName = ""

/////Multer setup

const storage = multer.diskStorage({
  destination : function (req, file, cb){
    cb(null, "Images");

  },
  filename : function (req, file, cb) {
    console.log(file);
    cb(null, username+req.body.name+".png")
  }
})

const upload = multer({storage : storage})

// get requests
app.get("/", function(req, res){
  res.render("home")
})

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] })
);

app.get('/auth/google/product',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/product');
  });

app.get("/product", function (req, res) {

  if(req.isAuthenticated()){
    User.findById(req.user.id, function(err, items){
      if(!err){
          res.render("product", {items : items.Items, dateRemain : dateRemain, percentage : percentage, imgURL : imgURL})
      } else {
        console.log(err)
      }
    })
  } else {
    console.log("user's not authenticated")
    res.redirect("/login")
  }

})

app.get("/download", function (req, res){

    res.download(__dirname + "/Images/"+ username + imgName +".png");
})

app.get("/register", function(req, res){
  res.render("register")
})

app.get("/login", function(req, res){
  res.render("login")
})

// post requests

app.post("/product", upload.single("receipt"), function (req, res){
  const buyDate = new Date(req.body.date);
  const period = req.body.warranty;

  function addFormat (date, value) {
    if(req.body.periods==="Days"){
      return moment(date).add(value, "d").format('MM-DD-YYYY');
    } else if(req.body.periods==="Months") {
    return moment(date).add(value, "M").format('MM-DD-YYYY');
  } else {
    return moment(date).add(value, "y").format('MM-DD-YYYY')
  }
}

//Pure Javascript version without using Moment >>>>>>>>

  // function expiryDate (date, value) {
  //   if(req.body.periods==="Days"){
  //     date.setDate(date.getDate() + value);
  //     return date;
  //   }
  //   else if(req.body.periods==="Months"){
  //     date.setMonth(date.getMonth() + value);
  //     return date;
  //   } else {
  //     date.setFullYear(date.getFullYear() + value);
  //     return date;
  //   }
  // }
// const options = {day: "numeric", month: "numeric", year: "numeric"};
// var dateFormat = expiryDate(buyDate, years).toLocaleDateString("en-US", options);

  // Calculate the expiry date of the product

  const item = new Item ({
      Name : req.body.name,
      Store : req.body.store,
      Start_Date : moment(req.body.date).format('MM-DD-YYYY'),
      End_Date : addFormat (buyDate, period),
      Period : req.body.warranty + " " + req.body.periods,
      Img_URL : req.body.image
  })

  User.findById(req.user.id, function (err, foundUser){
    if(!err){
      foundUser.Items.push(item);
      foundUser.save()
    } else {
      console.log(err)
    }
  })

  item.save(function(err) {
    if(err){
      console.log(err)
    }else {
      res.redirect("/product")
    }
  });

//Pushed  the newly entered data to the Array to render
})

app.post("/update", function (req, res){

if (req.body.button==="Delete") {

  User.findOneAndUpdate({_id : req.user.id}, {$pull : {Items : {Name : req.body.username}}}, function (err, foundItem) {
    if(err){
      console.log(err);
    } else {
      console.log("deleted from user")
    }
  })

  Item.deleteOne({Name : req.body.username}, function (err) {
    if(!err){
      console.log("deleted")
    }
  });
  dateRemain = "";
  percentage = 0;
  imgURL = ""

} else if(req.body.button==="Download") {
  imgName = req.body.username
  console.log(imgName)

res.redirect("/download")

} else {

  var expiryDate = moment(req.body.endDate)
  var startDate = moment(req.body.startDate)
  var today = moment()
  var thisDay = moment()

  if(expiryDate < today) {
    dateRemain = " Warranty has expired"
  } else {
  var years = expiryDate.diff(today, 'years')
  today.add(years, 'years')
  var months = expiryDate.diff(today, 'months')
  today.add(months, 'months')
  var days = expiryDate.diff(today, 'days')
  dateRemain = years + '  ' + 'Year(s)'+ '  ' + months + '  ' + 'Month(s)'+ '  ' + days + " Day(s)"

  var percentage_complete = (thisDay - startDate) / (expiryDate - startDate) * 100;
  var percentage_rounded = Math.round(percentage_complete)
  percentage = percentage_rounded + "%"
}

  imgURL = req.body.imgURL

}

  res.redirect("/product")
})

app.post("/login", function (req, res){

  const user = new User({
    username : req.body.username,
    password : req.body.password
  })

  req.login(user, function(err){
    if (err){
      console.log(err)
    } else {
     passport.authenticate("local")(req, res, function(){
     res.redirect("/product")
   })
   }
   })

})

app.post("/register", function(req, res){

  User.register({username : req.body.username}, req.body.password, function (err, user){
    if(err){
      console.log(err)
      res.redirect("/login")
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/product")
      })
    }
  })

})

app.post("/logout", function(req, res){

  dateRemain = "";
  percentage = 0;
  imgURL = ""

  req.logout(function(){
    res.redirect("/")
  });

})

app.listen(3000, function(){
  console.log("Server is running");
})

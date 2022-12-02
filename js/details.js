/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var NEEDINFO = null;

// http://127.0.0.1/?team=media
// http://127.0.0.1/details.html?team=media&userquery=odr&userid=docfaraday@gmail.com
$(document).ready(function () {
  let team = getTeam();

  if (team == undefined) {
    console.log("missing team url parameter.")
    return;
  }

  $.getJSON('js/' + team + '.json', function (data) {
    main(data);
  });
});

function prepPage() {
}

function main(json)
{
  NEEDINFO = json.needinfo;

  // user bugzilla id
  var userId = getUserId();
  if (userId == undefined) {
    console.log("missing user id url parameter.")
    return;
  }

  // odr, cdr, onb, cnb
  var userQuery = getUserQuery();
  if (userQuery == undefined) {
    console.log("missing user query url parameter.")
    return;
  }

  loadSettingsInternal();

  let id = encodeURIComponent(getUserId());
  let url = NEEDINFO.bugzilla_rest_url;

  //////////////////////////////////////////
  // Base query and resulting fields request
  //////////////////////////////////////////

  // v1={id}
  // o1=equals
  // f1=requestees.login_name

  // f2=flagtypes.name
  // o2=equals
  // v2=needinfo?

  if (NEEDINFO.api_key.length) {
    url += "api_key=" + NEEDINFO.api_key + "&";
  }
  url += NEEDINFO.bugs_query.replace("{id}", id);

  switch (userQuery) {
    //////////////////////////////////////////
    // Open Developer Related
    //////////////////////////////////////////
    case 'odr':
      url += "&f3=setters.login_name"
      url += "&o3=nowordssubstr"
      url += "&v3=release-mgmt-account-bot%40mozilla.tld"

      // Ignore needinfos set by the account we're querying for.
      if (NEEDINFO.ignoremyni) {
        url += "," + id;
      }

      url += "&f4=bug_status"
      url += "&o4=nowordssubstr"
      url += "&v4=RESOLVED%2CVERIFIED%2CCLOSED"
      break;

    //////////////////////////////////////////
    // Closed Developer Related
    //////////////////////////////////////////
    case 'cdr':
      url += "&f3=setters.login_name"
      url += "&o3=notequals"
      url += "&v3=release-mgmt-account-bot%40mozilla.tld"

      url += "&f4=bug_status"
      url += "&o4=anywordssubstr"
      url += "&v4=RESOLVED%2CVERIFIED%2CCLOSED"
      break;

    //////////////////////////////////////////
    // Open Nagbot
    //////////////////////////////////////////
    case 'onb':
      url += "&f3=setters.login_name"
      url += "&o3=equals"
      url += "&v3=release-mgmt-account-bot%40mozilla.tld"

      url += "&f4=bug_status"
      url += "&o4=nowordssubstr"
      url += "&v4=RESOLVED%2CVERIFIED%2CCLOSED"
      break;

    //////////////////////////////////////////
    // Closed Nagbot
    //////////////////////////////////////////
    case 'cnb':
      url += "&f3=setters.login_name"
      url += "&o3=equals"
      url += "&v3=release-mgmt-account-bot%40mozilla.tld"

      url += "&f4=bug_status"
      url += "&o4=anywordssubstr"
      url += "&v4=RESOLVED%2CVERIFIED%2CCLOSED"
      break;
  }

  console.log(url);

  retrieveInfoFor(url, userQuery);
}

// this function's sole reason for existing is to provide
// a capture context for the AJAX values...
function retrieveInfoFor(url, type)
{
    $.ajax({
      url: url,
      success: function (data) {
        displayCountFor(url, type, data);
      }
    })
    .error(function(jqXHR, textStatus, errorThrown) {
      console.log("error " + textStatus);
      console.log("incoming Text " + jqXHR.responseText);
    });
}

function displayCountFor(url, type, data) {
  console.log(data);
  data.bugs.forEach(function (bug) {
    let flagCreationDate = bug.flags[0].creation_date;
    console.log(bug.id, bug.summary);
    let index = 0;
    bug.flags.forEach(function (flag) {
      console.log(index, flag.creation_date, flag.name, flag.setter);
      index++;
    });
    index = 0;
    let commentIdx = -1;
    bug.comments.every(function (comment) {
      if (flagCreationDate == comment.creation_time) {
        // when someone sets an ni without commenting, there won't be a comment to match here.
        // usually the right comment is the previous in the array (they forgot to set the ni when
        // submitting a comment) but lets not mess around with false positives here. leave it blank.
        console.log(index, comment.creation_time, comment.creator);
        commentIdx = index;
        return false;
      }
      index++;
      return true;
    });
    console.log('comment id', commentIdx);
    if (commentIdx == -1) {
      addRow(flagCreationDate, bug.id, bug.severity, bug.priority, bug.flags[0].setter, "", -1, bug.summary);
    } else {
      addRow(flagCreationDate, bug.id, bug.severity, bug.priority, bug.flags[0].setter, bug.comments[commentIdx].text, commentIdx, bug.summary);
    }
  });
}

function addRow(ct, bugid, s, p, from, msg, cidx, title) {
  let dateStr = ct;

  // poster simplification
  let fromClean = from.replace('release-mgmt-account-bot@mozilla.tld', 'nagbot');

  // comment simplification
  let msgClean = msg;
  let clipIdx = msg.indexOf('For more information');
  if (clipIdx != -1)
    msgClean = msg.substring(0, clipIdx);

  let bugLink = "<a target='_blank' rel='noopener noreferrer' href='https://bugzilla.mozilla.org/show_bug.cgi?id=" + bugid + "'>" + bugid + "</a>";
  let titleLink = "<a class='nodecoration' target='_blank' rel='noopener noreferrer' href='https://bugzilla.mozilla.org/show_bug.cgi?id=" + bugid + "'>" + title + "</a>";
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1776524#c15
  let commentLink = "<a class='nodecoration' target='_blank' rel='noopener noreferrer' href='https://bugzilla.mozilla.org/show_bug.cgi?id=" + bugid + "#c" + cidx + "'>" + msgClean + "</a>";
  let content =
    "<div class='name-nidate'>" + dateStr + "</div>" +
    "<div class='name-bugid'>" + bugLink + "</div>" +
    "<div class='name-severity'>" + s + "</div>" +
    "<div class='name-priority'>" + p + "</div>" +
    "<div class='name-nifrom'>" + fromClean + "</div>" +
    "<div class='name-bugtitle'>" + titleLink + "</div>" +
    "<div class='name-nimsg'>" + commentLink + "</div>";

  if (content.length) {
    $("#report").append(content);
  }
}

/*
  {
    "summary": "Use StoragePrincipal for deviceId (and potentially QuotaManager if not used)",
      "flags": [
        {
          "creation_date": "2019-10-18T13:55:15Z",
          "requestee": "jib@mozilla.com",
          "modification_date": "2019-10-18T13:55:15Z",
          "name": "needinfo",
          "status": "?",
          "setter": "annevk@annevk.nl",
          "id": 1920605,
          "type_id": 800
        }
      ],
        "comments": [
          {
            "tags": [],
            "author": "annevk@annevk.nl",
            "id": 14432600,
            "creator": "annevk@annevk.nl",
            "time": "2019-10-18T13:55:15Z",
            "attachment_id": null,
            "creation_time": "2019-10-18T13:55:15Z",
            "text": "Per discussion with Jan-Ivar, StoragePrincipal is not used for deviceId at the moment which would allow circumventing some storage policies potentially.\n\nIn particular, if a user uses top-level A and A nested in top-level B (with B delegating permission once we have Feature Policy) the two As should probably not get to bypass StoragePrincipal separation even if they both have a WebRTC permission.",
            "raw_text": "Per discussion with Jan-Ivar, StoragePrincipal is not used for deviceId at the moment which would allow circumventing some storage policies potentially.\n\nIn particular, if a user uses top-level A and A nested in top-level B (with B delegating permission once we have Feature Policy) the two As should probably not get to bypass StoragePrincipal separation even if they both have a WebRTC permission.",
            "count": 0,
            "is_private": false,
            "bug_id": 1589685
          },
          {
            "text": "Very good point, happy to help integrate this with storage principal.",
            "creation_time": "2019-10-18T15:00:51Z",
            "attachment_id": null,
            "time": "2019-10-18T15:00:51Z",
            "bug_id": 1589685,
            "count": 1,
            "is_private": false,
            "raw_text": "Very good point, happy to help integrate this with storage principal.",
            "id": 14432708,
            "author": "ehsan.akhgari@gmail.com",
            "tags": [],
            "creator": "ehsan.akhgari@gmail.com"
          },
          {
            "creator": "achronop@gmail.com",
            "tags": [],
            "author": "achronop@gmail.com",
            "id": 14620873,
            "raw_text": "Jib, can you please follow up on the above?",
            "is_private": false,
            "count": 2,
            "bug_id": 1589685,
            "time": "2020-02-03T12:21:16Z",
            "creation_time": "2020-02-03T12:21:16Z",
            "attachment_id": null,
            "text": "Jib, can you please follow up on the above?"
          }
        ],
          "id": 1589685
  }
  */
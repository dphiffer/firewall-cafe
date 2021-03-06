<?php
/*
Template Name: Events
*/

get_header();
the_post();

?>
<section id="events">
	<div class="container">
		<h2><?php the_title(); ?></h2>
		<div class="columns">
			<div class="sidebar"><?php

			the_content();
			edit_post_link('Edit');

			?></div>
			<div class="content">
				<?php

				while ( have_rows( 'events' ) ) {
					the_row();
					?>
					<div class="event item">
						<div class="text">
							<h3><?php the_sub_field( 'title' ); ?></h3>
							<div class="post-content">
								<?php the_sub_field( 'description' ); ?>
							</div>
						</div>
					</div>
					<?php
				}

				edit_post_link('Edit');

				?>
			</div>
			<div class="right-sidebar">
				<h3>Locations</h3>
				<p>Oslo Freedom Forum<br>
					<a href="https://www.google.com/maps/place/Sentralen/@59.911125,10.7381283,17z/data=!3m1!4b1!4m5!3m4!1s0x46416e87dc342c95:0xd1f208bf00afc87d!8m2!3d59.911125!4d10.740317" target="_blank">Oslo, Norway</a></p>
				<p>Oslo Freedom Forum in New York<br>
					<a href="https://www.google.com/maps/place/Lincoln+Center+for+the+Performing+Arts/@40.7724641,-73.9856776,17z/data=!3m1!4b1!4m5!3m4!1s0x89c258f55fbea537:0x49d5f074061cac4e!8m2!3d40.7724641!4d-73.9834889" target="_blank">Lincoln Center</a></p>
				<p>Orbital (roundtable discussions)<br>
					<a href="https://www.google.com/maps/place/155+Rivington+St,+New+York,+NY+10002/@40.719022,-73.9878237,17z/data=!3m1!4b1!4m2!3m1!1s0x89c25981a8a71255:0xa95d42168a8a83d3?hl=en-US" target="_blank">155 Rivington St</a></p>
				<p>Chinatown Soup (reception)<br>
					<a href="https://www.google.com/maps/place/16+Orchard+St,+New+York,+NY+10002/@40.7151415,-73.9939575,17z/data=!3m1!4b1!4m2!3m1!1s0x89c25a29b5a326c1:0x8038978486a4c2d3?hl=en-US" target="_blank">16B Orchard St</a></p>
			</div>
		</div>
	</div>
</section>
<?php

get_footer();
